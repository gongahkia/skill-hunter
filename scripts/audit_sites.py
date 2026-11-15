#!/usr/bin/env python3
"""Audit inline previews in Chromium and save evidence without changing the extension."""
from __future__ import annotations

import argparse
import base64
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote, urlsplit

from prepare_safari import ROOT, validate_resources
from safari_browser_smoke import WebDriver


SNAPSHOT = """
const root = document.querySelector('#legisContent, #divJudgement');
if (!root) return {root:false,title:document.title,body:document.body?.innerText.slice(0,1200)};
if (arguments[0]) window.__skillHunterAuditElements = [root, ...root.querySelectorAll('*')];
const groups = new Map();
root.querySelectorAll('[data-skill-hunter-reference]').forEach(el => {
    const id = el.getAttribute('data-skill-hunter-reference');
    groups.set(id, (groups.get(id) || '') + el.textContent);
});
const box = root.getBoundingClientRect();
return {
    root:true,title:document.title,text:root.textContent,
    overflow:document.documentElement.style.overflow,
    box:[box.width,box.height].map(value => Math.round(value*100)/100),
    originals_retained:(window.__skillHunterAuditElements || []).every(el => el.isConnected && (el===root || root.contains(el))),
    references:Array.from(groups, ([id,label]) => ({id,label:label.replace(/\\s+/g,' ').trim()})),
    heading_annotations:root.querySelectorAll('[class*="prov"][class*="Hdr"] [data-skill-hunter-reference]').length,
    definition_count:root.querySelectorAll('.def').length,
    section_anchors:Array.from(root.querySelectorAll('[id]')).map(el=>el.id).filter(id=>/^pr\\d+[A-Z]*-(?:he-)?$/i.test(id)).slice(0,12)
};
"""
CARD = """function() {
    const card=this.querySelector('.card');
    if (!card) return null;
    return {hidden:card.hidden,kind:card.querySelector('.kind')?.textContent || '',
        title:card.querySelector('h2')?.textContent || '',text:card.querySelector('p')?.textContent || '',
        detail:card.querySelector('.detail')?.textContent || '',
        links:Array.from(card.querySelectorAll('a')).map(el=>el.href)};
}"""
FIXTURE_APIS = """
window.__skillHunterAuditLookups=[];
Object.defineProperty(window,'chrome',{configurable:true,value:{
    runtime:{onMessage:{addListener(){}},sendMessage:async function(message){
        window.__skillHunterAuditLookups.push(message);
        return {ok:false,error:'No remote source is configured for fixture mode'};
    }},
    storage:{local:{get:async()=>({})},onChanged:{addListener(fn){window.__skillHunterAuditChange=fn;}}}
}});
"""


def supported_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        return False
    if parsed.hostname == "sso.agc.gov.sg":
        return bool(re.fullmatch(r"/(Act|Act-Rev|SL|Bills-Supp)/[^/]+/?", parsed.path, re.I))
    return parsed.hostname == "www.elitigation.sg" and bool(
        re.fullmatch(r"/(gd|gdviewer)/s/\d{4}_SG[A-Z]+_\d+/?", parsed.path)
    )


def load_targets(path, fixtures, only):
    targets = json.loads(path.read_text())["fixtures" if fixtures else "live"]
    if not isinstance(targets, list) or not all(isinstance(target, dict) for target in targets):
        raise ValueError("Audit targets must be a list of objects")
    ids = set()
    for target in targets:
        identifier = target.get("id", "")
        if not re.fullmatch(r"[a-z0-9-]+", identifier) or identifier in ids:
            raise ValueError(f"Invalid or duplicate audit target: {identifier!r}")
        ids.add(identifier)
        if fixtures:
            fixture = (ROOT / target["fixture"]).resolve()
            if not fixture.is_relative_to(ROOT / "tests/fixtures") or not fixture.is_file() or fixture.suffix != ".html":
                raise ValueError(f"Missing or unsafe fixture: {target['fixture']}")
        elif not supported_url(target.get("url", "")):
            raise ValueError(f"Unsupported audit URL: {target.get('url')}")
        probes = target.get("probes", [])
        if not isinstance(probes, list) or len(probes) > 8 or not all(isinstance(probe, dict) for probe in probes):
            raise ValueError(f"Expected at most 8 probes for {identifier}")
        if not isinstance(target.get("sample", 2), int) or not 1 <= target.get("sample", 2) <= 8:
            raise ValueError(f"Sample size must be between 1 and 8 for {identifier}")
        for probe in probes:
            if not isinstance(probe.get("label"), str) or not probe["label"].strip():
                raise ValueError(f"A probe label is required for {identifier}")
            if probe.get("match", "exact") not in ("exact", "contains"):
                raise ValueError(f"Unsupported label match for {identifier}")
            kinds = probe.get("kind", [])
            if not (isinstance(kinds, str) or isinstance(kinds, list) and all(isinstance(kind, str) for kind in kinds)):
                raise ValueError(f"Invalid preview kind for {identifier}")
            if not isinstance(probe.get("contains", []), list) or not all(isinstance(text, str) for text in probe.get("contains", [])):
                raise ValueError(f"Expected text fragments must be strings for {identifier}")
            if "after" in probe and not isinstance(probe["after"], str):
                raise ValueError(f"Expected a CSS boundary selector for {identifier}")
    if only:
        unknown = set(only) - ids
        if unknown:
            raise ValueError(f"Unknown targets: {', '.join(sorted(unknown))}")
        targets = [target for target in targets if target["id"] in only]
    if not targets:
        raise ValueError("No audit targets selected")
    return targets


def normal(value):
    return re.sub(r"\s+", " ", value).strip().casefold()


def blocked_document(snapshot):
    if snapshot.get("root"):
        return False
    text = f"{snapshot.get('title', '')} {snapshot.get('body', '')}"
    return bool(re.search(r"403\s*(?:error|forbidden)|access denied|request blocked|verify you are human|captcha", text, re.I))


def preview_status(card, probe):
    if card["kind"] == "Preview unavailable":
        return "blocked" if re.search(r"\bHTTP\s+403\b|access denied|request blocked", card["text"], re.I) else "unavailable"
    kinds = probe.get("kind", [])
    if isinstance(kinds, str):
        kinds = [kinds]
    if not card.get("title", "").strip() or not card["text"].strip() or (kinds and not any(card["kind"].startswith(kind) for kind in kinds)):
        return "failed"
    if not all(normal(text) in normal(card["text"]) for text in probe.get("contains", [])):
        return "failed"
    if any(urlsplit(link).scheme != "https" for link in card.get("links", [])):
        return "failed"
    return "passed"


def overall_status(checks):
    for status in ("failed", "blocked", "unavailable"):
        if any(check["status"] == status for check in checks):
            return status
    return "passed" if checks else "unavailable"


def exit_code(results):
    if any(result["status"] == "failed" for result in results):
        return 1
    return 0 if results and all(result["status"] == "passed" for result in results) else 3


def wait_for(callback, timeout, description):
    deadline = time.monotonic() + timeout
    while True:
        value = callback()
        if value:
            return value
        if time.monotonic() >= deadline:
            raise RuntimeError(f"Timed out waiting for {description}")
        time.sleep(0.2)


class AuditBrowser:
    def __init__(self, driver, fixtures, timeout, extension):
        self.driver, self.fixtures, self.timeout = driver, fixtures, timeout
        self.controller = self.page = None
        self.extension_id = None
        self.extension = extension

    def cdp(self, command, **params):
        return self.driver.request("/goog/cdp/execute", {"cmd": command, "params": params})

    def initialize(self):
        if self.fixtures:
            return
        def extension_worker():
            return next((target for target in self.cdp("Target.getTargets")["targetInfos"]
                         if target["url"].startswith("chrome-extension://") and target["url"].endswith("/background.js")), None)
        worker = wait_for(extension_worker, 10, "the unpacked extension; use Chromium or Chrome for Testing")
        self.extension_id = worker["url"].split("/")[2]
        self.controller = self.driver.request("/window", method="GET")
        self.driver.request("/url", {"url": f"chrome-extension://{self.extension_id}/popup.html"})
        actual = self.driver.js("return chrome.runtime.id")
        if actual != self.extension_id:
            raise RuntimeError("Could not access the installed extension")
        self.page = self.driver.request("/window/new", {"type": "tab"})["handle"]
        self.driver.request("/window", {"handle": self.page})

    def set_enabled(self, enabled):
        if self.fixtures:
            self.driver.js('window.__skillHunterAuditChange({"skill-hunter.inline.enabled":{newValue:arguments[0]}},"local")', enabled)
            return
        self.driver.request("/window", {"handle": self.controller})
        try:
            response = self.driver.request("/execute/async", {
                "script": 'const done=arguments[arguments.length-1];chrome.storage.local.set({"skill-hunter.inline.enabled":arguments[0]}).then(()=>done({ok:true}),error=>done({error:String(error)}));',
                "args": [enabled],
            })
            if not response.get("ok"):
                raise RuntimeError(response.get("error", "Could not update the preview setting"))
        finally:
            self.driver.request("/window", {"handle": self.page})

    def load(self, target):
        if self.fixtures:
            html = (ROOT / target["fixture"]).read_text()
            self.driver.request("/url", {"url": "data:text/html;charset=utf-8," + quote(html)})
            self.driver.js(FIXTURE_APIS)
            self.driver.js((self.extension / "content.js").read_text())
            wait_for(lambda: self.driver.js("return typeof window.__skillHunterAuditChange==='function'"), self.timeout, "fixture initialization")
        else:
            self.set_enabled(False)
            self.driver.request("/url", {"url": target["url"]})
        previous, stable_since = None, time.monotonic()
        def ready_source():
            nonlocal previous, stable_since
            snapshot = self.driver.js(SNAPSHOT, False)
            if blocked_document(snapshot):
                return snapshot
            if not snapshot.get("root") or not snapshot.get("text", "").strip():
                return None
            if snapshot["text"] != previous:
                previous, stable_since = snapshot["text"], time.monotonic()
            return snapshot if time.monotonic() - stable_since >= 0.6 else None
        return wait_for(ready_source, self.timeout, "a stable readable document or an access-block page")

    def after_boundary(self, reference, selector):
        return self.driver.js('const boundary=document.querySelector(arguments[0]);const el=Array.from(document.querySelectorAll("[data-skill-hunter-reference]")).find(el=>el.getAttribute("data-skill-hunter-reference")===arguments[1]);return !!(boundary && el && (boundary.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));', selector, reference["id"])

    def definition_diagnostic(self, label):
        return self.driver.js('const term=arguments[0].toLocaleLowerCase();const el=Array.from(document.querySelectorAll("#legisContent .def")).find(el=>/^[“"]([^”"]+)[”"]/.exec(el.textContent.trim())?.[1].toLocaleLowerCase()===term);return el?{definition:el.outerHTML.slice(0,6000),container:el.parentElement.closest("td")?.outerHTML.slice(0,1600)}:null;', label)

    def card(self):
        root = self.cdp("DOM.getDocument", depth=0)["root"]["nodeId"]
        host = self.cdp("DOM.querySelector", nodeId=root, selector="#skill-hunter-previews")["nodeId"]
        if not host:
            return None
        node = self.cdp("DOM.describeNode", nodeId=host, depth=1, pierce=True)["node"]
        if not node.get("shadowRoots"):
            return None
        obj = self.cdp("DOM.resolveNode", backendNodeId=node["shadowRoots"][0]["backendNodeId"])["object"]["objectId"]
        try:
            response = self.cdp("Runtime.callFunctionOn", objectId=obj, functionDeclaration=CARD, returnByValue=True)
            if "exceptionDetails" in response:
                raise RuntimeError("Could not inspect the preview panel")
            return response["result"].get("value")
        finally:
            self.cdp("Runtime.releaseObject", objectId=obj)

    def hover(self, reference):
        self.driver.move("viewport", 1, 1)
        self.driver.request("/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyDown", "value": "\ue00c"}, {"type": "keyUp", "value": "\ue00c"}]}]})
        target = self.driver.js('const el=Array.from(document.querySelectorAll("[data-skill-hunter-reference]")).find(el=>el.getAttribute("data-skill-hunter-reference")===arguments[0]);if(el)el.scrollIntoView({block:"center"});return el;', reference["id"])
        if not target:
            raise RuntimeError("The annotated reference disappeared")
        self.driver.move(target)
        def ready_card():
            card = self.card()
            return card if card and not card["hidden"] and not card["kind"].startswith("Loading") else None
        return wait_for(ready_card, self.timeout, "the hover preview")

    def screenshot(self, destination):
        destination.write_bytes(base64.b64decode(self.driver.request("/screenshot", method="GET")))

    def capture(self, destination):
        html = self.driver.js("""const clone=document.documentElement.cloneNode(true);
            clone.querySelectorAll('#skill-hunter-previews,script,style,link,img,iframe,object,embed').forEach(el=>el.remove());
            clone.querySelectorAll('[data-skill-hunter-reference]').forEach(el=>el.replaceWith(...el.childNodes));
            clone.querySelectorAll('*').forEach(el=>Array.from(el.attributes).forEach(attr=>{
                if(/^on/i.test(attr.name) || (/^(href|src|action|formaction)$/i.test(attr.name) && /^\\s*javascript:/i.test(attr.value)))el.removeAttribute(attr.name);
            }));return clone.outerHTML;""")
        destination.write_text(html)


@contextmanager
def browser_session(args):
    executable = args.browser or shutil.which("chromium") or shutil.which("chromium-browser")
    driver_executable = args.driver or shutil.which("chromedriver")
    if not executable or not driver_executable:
        raise RuntimeError("Chromium (or Chrome for Testing) and a matching chromedriver are required; use --browser and --driver for custom paths")
    validate_resources(ROOT / "dist", safari=False)
    with tempfile.TemporaryDirectory(prefix="skill-hunter-audit-") as directory:
        profile = Path(directory) / "profile"
        if args.profile:
            profile = args.profile.resolve()
            marker = profile / ".skill-hunter-audit-profile"
            if profile.exists() and any(profile.iterdir()) and not marker.is_file():
                raise ValueError("Refusing to use an existing personal/unowned browser profile; choose an empty dedicated directory")
            profile.mkdir(parents=True, exist_ok=True)
            marker.write_text("Dedicated Skill Hunter audit profile.\n")
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        with (Path(directory) / "driver.log").open("w+") as log:
            process = subprocess.Popen([driver_executable, f"--port={port}"], stdout=log, stderr=log)
            driver = WebDriver(f"http://127.0.0.1:{port}", timeout=args.timeout + 5)
            try:
                def ready_driver():
                    if process.poll() is not None:
                        raise RuntimeError("chromedriver exited before starting")
                    try:
                        return driver.request("/status")
                    except OSError:
                        return None
                wait_for(ready_driver, 10, "chromedriver")
                flags = [f"--user-data-dir={profile}"]
                if not args.headed:
                    flags.append("--headless=new")
                if not args.fixtures:
                    flags += [f"--load-extension={ROOT / 'dist'}", f"--disable-extensions-except={ROOT / 'dist'}"]
                session = driver.request("/session", {"capabilities": {"alwaysMatch": {
                    "browserName": "chrome", "goog:chromeOptions": {"binary": executable, "args": flags}}}})
                driver.session = "/session/" + session["sessionId"]
                driver.request("/timeouts", {"pageLoad": int(args.timeout * 1000), "script": int(args.timeout * 1000)})
                browser = AuditBrowser(driver, args.fixtures, args.timeout, ROOT / "dist")
                browser.initialize()
                yield browser, session["capabilities"].get("browserVersion", "unknown")
            finally:
                if driver.session:
                    try:
                        driver.request("", method="DELETE")
                    except (OSError, RuntimeError):
                        pass
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=10)


def audit_target(browser, target, output, capture_html):
    result = {"id": target["id"], "url": target.get("url", f"fixture:{target.get('fixture')}"), "checks": []}
    started = time.monotonic()
    def check(name, passed, **details):
        result["checks"].append({"name": name, "status": "passed" if passed else "failed", **details})
    def evidence(name):
        destination = output / f"{target['id']}-{name}.png"
        try:
            browser.screenshot(destination)
            return destination.name
        except (OSError, RuntimeError) as error:
            result.setdefault("artifact_errors", []).append(str(error))
            return None
    try:
        initial = browser.load(target)
        if blocked_document(initial):
            result["checks"].append({"name": "source_access", "status": "blocked", "title": initial.get("title"), "message": initial.get("body"), "screenshot": evidence("blocked")})
        else:
            before = browser.driver.js(SNAPSHOT, True)
            result["source"] = {"title": before["title"], "text_length": len(before["text"]), "text_sha256": hashlib.sha256(before["text"].encode()).hexdigest(), "definition_count": before["definition_count"], "section_anchors": before["section_anchors"]}
            if capture_html:
                destination = output / f"{target['id']}-source.html"
                browser.capture(destination)
                result["source"]["capture"] = destination.name
            browser.set_enabled(True)
            def annotated_source():
                snapshot = browser.driver.js(SNAPSHOT, False)
                return snapshot if snapshot.get("references") else None
            after = wait_for(annotated_source, browser.timeout, "inline annotations")
            result["reference_count"] = len(after["references"])
            result["references"] = after["references"][:100]
            check("source_text_preserved", before["text"] == after["text"])
            check("title_preserved", before["title"] == after["title"])
            check("original_elements_preserved", after["originals_retained"])
            check("source_layout_preserved", before["box"] == after["box"] and before["overflow"] == after["overflow"])
            if browser.fixtures or urlsplit(target["url"]).hostname == "sso.agc.gov.sg":
                check("section_headings_plain", after["heading_annotations"] == 0, count=after["heading_annotations"])
            probes = target.get("probes") or [{"label": ref["label"]} for ref in after["references"][:target.get("sample", 2)]]
            for index, probe in enumerate(probes):
                label = normal(probe["label"])
                reference = None
                for candidate in after["references"]:
                    matches = label in normal(candidate["label"]) if probe.get("match") == "contains" else label == normal(candidate["label"])
                    if matches and (not probe.get("after") or browser.after_boundary(candidate, probe["after"])):
                        reference = candidate
                        break
                if reference is None:
                    check("reference_annotated", False, label=probe["label"], source_definition=browser.definition_diagnostic(probe["label"]), screenshot=evidence(f"probe-{index}"))
                    continue
                card = browser.hover(reference)
                status = preview_status(card, probe)
                if status == "passed" and not browser.fixtures and not card.get("links"):
                    status = "failed"
                item = {"name": "hover_preview", "label": probe["label"], "status": status, "preview": card}
                if status != "passed":
                    item["screenshot"] = evidence(f"probe-{index}")
                result["checks"].append(item)
            if browser.fixtures:
                check("fixture_uses_no_remote_sources", browser.driver.js("return window.__skillHunterAuditLookups.length") == 0)
    except (OSError, RuntimeError) as error:
        result["checks"].append({"name": "audit_execution", "status": "failed", "message": str(error), "screenshot": evidence("error")})
    finally:
        try:
            browser.set_enabled(False)
            if result.get("source"):
                restored = browser.driver.js(SNAPSHOT, False)
                check("annotations_removed", restored.get("root") and not restored.get("references"))
                check("source_restored", restored.get("text") == before["text"] and restored.get("title") == before["title"] and restored.get("originals_retained"))
        except (OSError, RuntimeError) as error:
            result["checks"].append({"name": "cleanup", "status": "failed", "message": str(error)})
    result["status"] = overall_status(result["checks"])
    result["duration_seconds"] = round(time.monotonic() - started, 2)
    if result["status"] == "failed":
        result["screenshot"] = evidence("failed")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", action="store_true", help="Use offline fixtures and simulated extension APIs; no live-site claims")
    parser.add_argument("--targets", type=Path, default=ROOT / "scripts/audit_targets.json")
    parser.add_argument("--only", action="append", help="Run only a named target; repeat for multiple targets")
    parser.add_argument("--browser", help="Path to Chromium or Chrome for Testing")
    parser.add_argument("--driver", help="Path to a matching chromedriver")
    parser.add_argument("--headed", action="store_true", help="Show the dedicated audit browser")
    parser.add_argument("--profile", type=Path, help="Reuse an empty or tool-owned dedicated profile")
    parser.add_argument("--capture-html", action="store_true", help="Save sanitized rendered HTML for regression investigation")
    parser.add_argument("--output", type=Path, help="Artifact directory; defaults to a timestamped build/audit/ directory")
    parser.add_argument("--timeout", type=float, default=45, help="Page/probe timeout in seconds (default: 45)")
    args = parser.parse_args()
    if not 0 < args.timeout <= 120:
        parser.error("--timeout must be between 0 and 120 seconds")
    mode = "fixtures" if args.fixtures else "live"
    started = datetime.now(timezone.utc)
    output = args.output or ROOT / "build/audit" / f"{mode}-{started.strftime('%Y%m%dT%H%M%S%fZ')}"
    targets = load_targets(args.targets, args.fixtures, args.only)
    output.mkdir(parents=True, exist_ok=True)
    report = {"schema_version": 1, "mode": mode, "extension_apis": "simulated" if args.fixtures else "native", "started_at": started.isoformat(), "results": []}
    try:
        with browser_session(args) as (browser, version):
            report["browser"] = f"Chromium {version}"
            report["extension_id"] = browser.extension_id
            for target in targets:
                result = audit_target(browser, target, output, args.capture_html)
                report["results"].append(result)
                print(f"[{result['status']}] {target['id']} ({result['duration_seconds']}s)", flush=True)
    except (OSError, RuntimeError, ValueError) as error:
        report["error"] = str(error)
    report["summary"] = dict(Counter(result["status"] for result in report["results"]))
    destination = output / "report.json"
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"Report: {destination}", flush=True)
    if "error" in report:
        print(f"Audit unavailable: {report['error']}", flush=True)
        return 2
    return exit_code(report["results"])


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, KeyError) as error:
        print(f"Audit setup failed: {error}", file=sys.stderr)
        raise SystemExit(2)
