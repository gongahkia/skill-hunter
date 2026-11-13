#!/usr/bin/env python3
"""Validate the built Safari container, embedded extension and compiled web resources."""
import argparse
import json
import plistlib
from pathlib import Path
from prepare_safari import ROOT, validate_resources


def validate_app(app: Path):
    extension = app / "Contents/PlugIns/Skill Hunter Extension.appex"
    with (app / "Contents/Info.plist").open("rb") as f:
        app_info = plistlib.load(f)
    with (extension / "Contents/Info.plist").open("rb") as f:
        extension_info = plistlib.load(f)
    expected = json.loads((ROOT / "package.json").read_text())["version"]
    for info, identifier in [(app_info, "dev.gongahkia.skillhunter"), (extension_info, "dev.gongahkia.skillhunter.extension")]:
        if info.get("CFBundleIdentifier") != identifier:
            raise ValueError(f"Incorrect bundle identifier: {identifier}")
        if info.get("CFBundleShortVersionString") != expected:
            raise ValueError("Native bundle version differs from package.json")
    if extension_info.get("NSExtension", {}).get("NSExtensionPointIdentifier") != "com.apple.Safari.web-extension":
        raise ValueError("Safari WebExtension registration is missing")
    for bundle, info in [(app, app_info), (extension, extension_info)]:
        executable = info.get("CFBundleExecutable")
        if not executable or not (bundle / "Contents/MacOS" / executable).is_file():
            raise ValueError("Native executable is missing")
    manifest = validate_resources(extension / "Contents/Resources")
    if manifest["version"] != expected:
        raise ValueError("Packaged web manifest version differs from package.json")
    resources = app / "Contents/Resources"
    for path in ("Base.lproj/Main.html", "Script.js", "Style.css", "Icon.png"):
        if not (resources / path).is_file():
            raise ValueError(f"Container app resource missing: {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path)
    args = parser.parse_args()
    validate_app(args.app)
    print("Safari app and embedded WebExtension bundle passed validation.")
