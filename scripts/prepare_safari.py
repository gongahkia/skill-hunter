#!/usr/bin/env python3
"""Stage the production WebExtension for Safari without changing the shared dist build."""
from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = ".skill-hunter-generated"


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.paths.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet" and attrs.get("href"):
            self.paths.append(attrs["href"])


def local_file(directory: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or ":" in relative or "\\" in relative:
        raise ValueError(f"Expected a local resource path: {relative!r}")
    target = (directory / relative).resolve()
    if not target.is_relative_to(directory.resolve()) or not target.is_file():
        raise ValueError(f"Missing or unsafe extension resource: {relative}")
    return target


def validate_resources(directory: Path, safari=True) -> dict:
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest.get("manifest_version") != 3:
        raise ValueError("Expected a Manifest V3 extension")
    background = manifest.get("background", {})
    if safari and (background.get("persistent") is not False or "service_worker" in background):
        raise ValueError("Safari must use a nonpersistent background script")
    scripts = background.get("scripts", []) or [background.get("service_worker")]
    resources = list(scripts) + list(manifest.get("icons", {}).values())
    for entry in manifest.get("content_scripts", []):
        resources.extend(entry.get("js", []))
        resources.extend(entry.get("css", []))
    action = manifest.get("action", {})
    resources.extend(action.get("default_icon", {}).values())
    popup = action.get("default_popup")
    if not popup:
        raise ValueError("The toolbar popup is required")
    resources.append(popup)
    for resource in resources:
        local_file(directory, resource)
    parser = LocalReferences()
    parser.feed(local_file(directory, popup).read_text())
    for path in parser.paths:
        local_file(directory, str(Path(popup).parent / path))
    for path in directory.rglob("*"):
        if path.suffix in {".ts", ".tsx", ".map", ".swift", ".md"}:
            raise ValueError(f"Source file found in production resources: {path.name}")
    for entry in ("background.js", "content.js", "popup.js"):
        local_file(directory, entry)
    return manifest


def safari_manifest(manifest: dict) -> dict:
    result = json.loads(json.dumps(manifest))
    background = result.get("background", {})
    scripts = background.get("scripts") or [background.get("service_worker")]
    if not scripts or not all(isinstance(script, str) and script for script in scripts):
        raise ValueError("Missing compiled background entry point")
    result["background"] = {"scripts": scripts, "persistent": False}
    result.pop("browser_specific_settings", None)
    result.pop("minimum_chrome_version", None)
    return result


def safe_output(source: Path, output: Path):
    source, output = source.resolve(), output.resolve()
    if source.is_relative_to(output) or output.is_relative_to(source):
        raise ValueError("Output must not overlap the shared production build")
    if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT / "build"):
        raise ValueError("Generated files inside the repository must be under build/")
    if output.exists() and any(output.iterdir()) and not (output / MARKER).is_file():
        raise ValueError("Refusing to replace a directory not owned by this build")


def prepare(source: Path, output: Path):
    source, output = source.resolve(), output.resolve()
    validate_resources(source, safari=False)
    safe_output(source, output)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".skill-hunter-", dir=output.parent))
    try:
        shutil.copytree(source, stage, dirs_exist_ok=True)
        manifest = safari_manifest(json.loads((source / "manifest.json").read_text()))
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        (stage / MARKER).write_text("Generated Skill Hunter Safari resources.\n")
        validate_resources(stage)
        if output.exists():
            shutil.rmtree(output)
        stage.rename(output)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    return output


def install_resources(stage: Path, destination: Path):
    destination = destination.resolve()
    if destination.parts[-2:] != ("Contents", "Resources") or destination.parent.parent.suffix != ".appex":
        raise ValueError("Bundle destination must be an .appex/Contents/Resources directory")
    safe_output(stage, destination)
    validate_resources(stage)
    # This phase is the sole owner of the extension target's generated Resources.
    # On subsequent builds its marker prevents deleting unrelated files.
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(stage, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "dist")
    parser.add_argument("--output", type=Path, default=ROOT / "build/safari-extension")
    parser.add_argument("--bundle-resources", type=Path)
    args = parser.parse_args()
    stage = prepare(args.source, args.output)
    if args.bundle_resources:
        install_resources(stage, args.bundle_resources)
    print(f"Safari resources validated: {args.bundle_resources or stage}")


if __name__ == "__main__":
    main()
