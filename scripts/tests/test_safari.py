"""Portable regression tests for Safari resource staging and native bundle validation."""
import json
import plistlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare_safari import MARKER, ROOT, install_resources, prepare, validate_resources
from check_safari_app import validate_app


class SafariPackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "dist"
        self.output = self.root / "safari-extension"
        self.source.mkdir()
        self.manifest = json.loads((ROOT / "src/manifest.json").read_text())
        self.write_manifest()
        # Reproduce the production file graph, including the toolbar popup's assets.
        for name in ("content.js", "background.js", "popup.js", "styles/popup.css"):
            self.write(name, "/* compiled fixture */")
        for name in self.manifest["icons"].values():
            self.write(name, "icon fixture")
        self.write("popup.html", '<link rel="stylesheet" href="styles/popup.css"><script src="popup.js"></script>')

    def write(self, name, text):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def write_manifest(self):
        (self.source / "manifest.json").write_text(json.dumps(self.manifest))

    def test_stages_safari_without_changing_shared_extension(self):
        original = (self.source / "manifest.json").read_bytes()
        prepare(self.source, self.output)
        manifest = validate_resources(self.output)
        self.assertEqual(manifest["background"], {"scripts": ["background.js"], "persistent": False})
        self.assertNotIn("browser_specific_settings", manifest)
        self.assertNotIn("minimum_chrome_version", manifest)
        for key in ("action", "content_scripts", "host_permissions", "permissions", "version"):
            self.assertEqual(manifest[key], self.manifest[key])
        self.assertEqual((self.source / "manifest.json").read_bytes(), original)
        self.assertEqual((self.output / "content.js").read_bytes(), (self.source / "content.js").read_bytes())

    def test_missing_background_or_popup_asset_fails_before_replacing_previous_build(self):
        for name in ("background.js", "styles/popup.css", "popup.js"):
            with self.subTest(name=name):
                prepare(self.source, self.output)
                path = self.source / name
                previous = path.read_bytes()
                path.unlink()
                with self.assertRaises(ValueError):
                    prepare(self.source, self.output)
                validate_resources(self.output)
                path.write_bytes(previous)

    def test_typescript_and_source_maps_are_not_packaged(self):
        for name in ("content.ts", "content.js.map"):
            with self.subTest(name=name):
                self.write(name, "source fixture")
                with self.assertRaisesRegex(ValueError, "Source file"):
                    prepare(self.source, self.output)
                (self.source / name).unlink()

    def test_rejects_resource_outside_extension(self):
        (self.root / "external.js").write_text("outside")
        self.manifest["background"] = {"scripts": ["../external.js"]}
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "unsafe"):
            prepare(self.source, self.output)

    def test_rejects_overlapping_output(self):
        with self.assertRaisesRegex(ValueError, "overlap"):
            prepare(self.source, self.source / "safari")
        self.assertTrue((self.source / "content.js").exists())

    def test_preserves_unowned_directory(self):
        self.output.mkdir()
        (self.output / "keep.txt").write_text("keep")
        with self.assertRaisesRegex(ValueError, "not owned"):
            prepare(self.source, self.output)
        self.assertEqual((self.output / "keep.txt").read_text(), "keep")

    def test_rebuild_removes_stale_generated_files(self):
        prepare(self.source, self.output)
        (self.output / "old.js").write_text("stale")
        prepare(self.source, self.output)
        self.assertFalse((self.output / "old.js").exists())
        self.assertTrue((self.output / MARKER).exists())

    def test_installs_and_rebuilds_extension_resources(self):
        destination = self.root / "Skill Hunter Extension.appex/Contents/Resources"
        prepare(self.source, self.output)
        install_resources(self.output, destination)
        validate_resources(destination)
        (destination / "old.js").write_text("stale")
        install_resources(self.output, destination)
        self.assertFalse((destination / "old.js").exists())

    def test_install_preserves_unowned_bundle_resources(self):
        destination = self.root / "Skill Hunter Extension.appex/Contents/Resources"
        destination.mkdir(parents=True)
        (destination / "keep.txt").write_text("keep")
        prepare(self.source, self.output)
        with self.assertRaisesRegex(ValueError, "not owned"):
            install_resources(self.output, destination)
        self.assertTrue((destination / "keep.txt").exists())

    def test_install_requires_extension_bundle_destination(self):
        prepare(self.source, self.output)
        with self.assertRaisesRegex(ValueError, "appex"):
            install_resources(self.output, self.root / "other")

    def create_app(self):
        app = self.root / "Skill Hunter.app"
        extension = app / "Contents/PlugIns/Skill Hunter Extension.appex"
        version = json.loads((ROOT / "package.json").read_text())["version"]
        for bundle, identifier in ((app, "dev.gongahkia.skillhunter"), (extension, "dev.gongahkia.skillhunter.extension")):
            info = {"CFBundleIdentifier": identifier, "CFBundleShortVersionString": version, "CFBundleExecutable": "executable"}
            if bundle == extension:
                info["NSExtension"] = {"NSExtensionPointIdentifier": "com.apple.Safari.web-extension"}
            (bundle / "Contents/MacOS").mkdir(parents=True)
            (bundle / "Contents/MacOS/executable").touch()
            (bundle / "Contents/Info.plist").write_bytes(plistlib.dumps(info))
        for name in ("Base.lproj/Main.html", "Script.js", "Style.css", "Icon.png"):
            path = app / "Contents/Resources" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
        prepare(self.source, self.output)
        install_resources(self.output, extension / "Contents/Resources")
        return app, extension

    def test_validates_complete_embedded_app(self):
        app, _ = self.create_app()
        validate_app(app)

    def test_rejects_missing_compiled_script_in_native_bundle(self):
        app, extension = self.create_app()
        (extension / "Contents/Resources/background.js").unlink()
        with self.assertRaisesRegex(ValueError, "background.js"):
            validate_app(app)

    def test_rejects_mismatched_native_version(self):
        app, extension = self.create_app()
        path = extension / "Contents/Info.plist"
        info = plistlib.loads(path.read_bytes())
        info["CFBundleShortVersionString"] = "0.0.0"
        path.write_bytes(plistlib.dumps(info))
        with self.assertRaisesRegex(ValueError, "version"):
            validate_app(app)


if __name__ == "__main__":
    unittest.main()
