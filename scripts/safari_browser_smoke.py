#!/usr/bin/env python3
"""Exercise compiled inline previews in real Safari with simulated extension APIs.

This does not install or test the native Safari WebExtension. Use safari-check to
build/validate that bundle, then enable it in Safari for an installed-extension test.
"""
import functools
import http.server
import json
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from prepare_safari import ROOT, validate_resources


class FixtureHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class WebDriver:
    def __init__(self, url):
        self.url = url
        self.session = ""

    def request(self, path, data=None, method=None):
        request = urllib.request.Request(
            self.url + self.session + path,
            data=None if data is None else json.dumps(data).encode(),
            headers={"Content-Type": "application/json"},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                value = json.load(response)["value"]
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()) from error
        if isinstance(value, dict) and "error" in value:
            raise RuntimeError(value)
        return value

    def js(self, script, *args):
        return self.request("/execute/sync", {"script": script, "args": list(args)})

    def wait(self, milliseconds):
        self.request("/execute/async", {"script": "setTimeout(arguments[arguments.length-1], arguments[0])", "args": [milliseconds]})

    def move(self, origin, x=0, y=0):
        self.request("/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [{"type": "pointerMove", "duration": 100, "origin": origin, "x": x, "y": y}]}]})


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def exercise(driver, fixture_url, resources):
    driver.request("/url", {"url": fixture_url})
    snapshot = 'return {text:document.getElementById("legisContent").textContent,title:document.title,box:document.getElementById("legisContent").getBoundingClientRect().toJSON()}'
    before = driver.js(snapshot)
    driver.js("""
        window.__roots = [];
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(options) {
            const root = attach.call(this, options);
            window.__roots.push(root);
            return root;
        };
        window.chrome = {
            runtime: {onMessage: {addListener() {}}},
            storage: {
                local: {get: async () => ({})},
                onChanged: {addListener(fn) {window.__change = fn;}}
            }
        };
        window.__originalClicked = false;
        document.getElementById('original-action').addEventListener('click', () => {
            window.__originalClicked = true;
        });
    """)
    driver.js((resources / "content.js").read_text())
    driver.wait(100)
    count = 'return document.querySelectorAll("[data-skill-hunter-reference]").length'
    require(driver.js(count) == 0, "Previews should start disabled")
    for iteration in range(3):
        driver.move("viewport", 1, 1)
        driver.js('window.__change({"skill-hunter.inline.enabled":{newValue:true}},"local")')
        require(driver.js(snapshot) == before, "Enabling changed source text, title, or layout")
        require(driver.js(count) > 0, "No inline references were added")
        target = driver.js('return Array.from(document.querySelectorAll("[data-skill-hunter-reference]")).find(el => el.textContent === "person")')
        require(target is not None, "Definition reference was not detected")
        driver.move(target)
        driver.wait(500)
        card = driver.js('const card = window.__roots.at(-1).querySelector(".card"); return {text:card.textContent,hidden:card.hidden}')
        require(not card["hidden"] and "company and an individual" in card["text"], "Pointer hover did not show the definition")
        driver.request("/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [{"type": "keyDown", "value": "\ue00c"}, {"type": "keyUp", "value": "\ue00c"}]}]})
        require(driver.js('return window.__roots.at(-1).querySelector(".card").hidden'), "Escape did not dismiss the card")
        driver.js('window.__change({"skill-hunter.inline.enabled":{newValue:false}},"local")')
        require(driver.js(count) == 0, "Disabling left inline references behind")
        require(driver.js(snapshot) == before, "Disabling changed the original page")
        print(f"Safari hover/toggle cycle {iteration + 1}: passed", flush=True)
    driver.js('document.getElementById("original-action").click()')
    require(driver.js("return window.__originalClicked"), "Original page control stopped working")


def main():
    executable = shutil.which("safaridriver")
    if not executable:
        raise RuntimeError("Safari's safaridriver is required; run this test on macOS.")
    resources = ROOT / "build/safari-extension"
    validate_resources(resources)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(FixtureHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    driver = WebDriver(f"http://127.0.0.1:{port}")
    process = None
    try:
        with tempfile.TemporaryFile() as log:
            process = subprocess.Popen([executable, "-p", str(port)], stdout=log, stderr=log)
            deadline = time.monotonic() + 10
            while True:
                try:
                    driver.request("/status")
                    break
                except (OSError, RuntimeError):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        log.seek(0)
                        raise RuntimeError("Could not start safaridriver: " + log.read().decode())
                    time.sleep(0.1)
            try:
                session = driver.request("/session", {"capabilities": {"alwaysMatch": {"browserName": "safari"}}})
            except RuntimeError as error:
                raise RuntimeError("Could not create a Safari automation session. Enable Allow Remote Automation in Safari's developer settings, then retry. " + str(error)) from error
            driver.session = "/session/" + session["sessionId"]
            fixture = f"http://127.0.0.1:{server.server_port}/tests/fixtures/legislation.html"
            exercise(driver, fixture, resources)
            print(json.dumps({
                "browser": "Safari " + session["capabilities"].get("browserVersion", ""),
                "mode": "Real Safari engine; extension APIs simulated, native extension not installed",
                "passed": ["disabled by default", "3 enable/disable cycles", "source text/title/layout preserved", "pointer hover preview", "Escape dismissal", "annotation cleanup", "original page control"],
            }))
    finally:
        if driver.session:
            try:
                driver.request("", method="DELETE")
            except (OSError, RuntimeError):
                pass
        if process and process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit(str(error))
