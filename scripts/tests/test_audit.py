"""Portable checks for audit coverage, result classification and target boundaries."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_sites import audit_target, blocked_document, exit_code, load_targets, overall_status, preview_status, supported_url
from prepare_safari import ROOT


class AuditTests(unittest.TestCase):
    def test_default_target_sets_are_valid_and_cover_nested_markup(self):
        manifest = ROOT / "scripts/audit_targets.json"
        live = load_targets(manifest, False, None)
        fixtures = load_targets(manifest, True, None)
        self.assertTrue(any("/SL/" in target["url"] for target in live))
        self.assertTrue(any("/gd/s/2013_" in target["url"] for target in live))
        self.assertTrue(any(probe.get("after") for target in live for probe in target.get("probes", [])))
        self.assertTrue(any("nested" in target["fixture"] for target in fixtures))

    def test_unknown_and_duplicate_targets_fail_before_browser_start(self):
        with self.assertRaisesRegex(ValueError, "Unknown targets"):
            load_targets(ROOT / "scripts/audit_targets.json", False, ["does-not-exist"])
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "targets.json"
            target = {"id": "duplicate", "url": "https://sso.agc.gov.sg/Act/PC1871"}
            manifest.write_text(json.dumps({"live": [target, target]}))
            with self.assertRaisesRegex(ValueError, "duplicate"):
                load_targets(manifest, False, None)

    def test_only_official_document_routes_are_allowed(self):
        for url in ["https://sso.agc.gov.sg/Act/PC1871?WholeDoc=1", "https://sso.agc.gov.sg/SL/91-RG8", "https://www.elitigation.sg/gd/s/2024_SGCA_12"]:
            self.assertTrue(supported_url(url))
        for url in ["http://sso.agc.gov.sg/Act/A", "https://sso.agc.gov.sg.evil.test/Act/A", "https://user:password@sso.agc.gov.sg/Act/A", "https://sso.agc.gov.sg/admin", "https://www.elitigation.sg/login"]:
            self.assertFalse(supported_url(url))

    def test_access_block_is_not_a_functional_failure_or_a_pass(self):
        self.assertTrue(blocked_document({"root": False, "title": "Error", "body": "403 ERROR Request blocked"}))
        self.assertEqual(overall_status([{"status": "blocked"}]), "blocked")
        self.assertEqual(exit_code([{"status": "blocked"}]), 3)
        self.assertFalse(blocked_document({"root": True, "text": "This legislation mentions a 403 error."}))

    def test_empty_and_incomplete_audits_do_not_pass(self):
        self.assertEqual(exit_code([]), 3)
        self.assertEqual(overall_status([]), "unavailable")
        self.assertEqual(exit_code([{"status": "passed"}, {"status": "unavailable"}]), 3)
        self.assertEqual(exit_code([{"status": "failed"}, {"status": "blocked"}]), 1)
        self.assertEqual(exit_code([{"status": "passed"}]), 0)

    def test_preview_block_and_unavailable_source_are_distinct(self):
        card = {"kind": "Preview unavailable", "text": "Source returned HTTP 403"}
        self.assertEqual(preview_status(card, {}), "blocked")
        card["text"] = "Source timed out"
        self.assertEqual(preview_status(card, {}), "unavailable")

    def test_preview_must_match_expected_type_text_and_safe_links(self):
        card = {"kind": "Definition", "title": "supplier", "text": "Supplier includes a fixture agent.", "links": ["https://sso.agc.gov.sg/Act/A"]}
        probe = {"kind": "Definition", "contains": ["fixture agent"]}
        self.assertEqual(preview_status(card, probe), "passed")
        self.assertEqual(preview_status(card, {"kind": "Judgment"}), "failed")
        self.assertEqual(preview_status(card, {"contains": ["missing continuation"]}), "failed")
        card["links"] = ["javascript:alert(1)"]
        self.assertEqual(preview_status(card, probe), "failed")

    def test_hover_failure_does_not_skip_later_probes_or_cleanup(self):
        source = {"root": True, "title": "Fixture", "text": "first second", "box": [400, 200], "overflow": "",
                  "originals_retained": True, "definition_count": 0, "section_anchors": [], "references": []}
        references = [{"id": "1", "label": "first"}, {"id": "2", "label": "second"}]
        browser = Mock(fixtures=False, timeout=1)
        browser.load.return_value = source
        browser.driver.js.side_effect = [source, {**source, "references": references}, source]
        browser.hover.side_effect = [RuntimeError("Hover timed out"), {
            "kind": "Judgment", "title": "Second case", "text": "Readable source text",
            "links": ["https://www.elitigation.sg/gd/s/2024_SGCA_12"],
        }]
        target = {"id": "probe-recovery", "url": "https://www.elitigation.sg/gd/s/2024_SGCA_12",
                  "probes": [{"label": "first"}, {"label": "second"}]}
        with tempfile.TemporaryDirectory() as directory:
            result = audit_target(browser, target, Path(directory), False)
        previews = [check for check in result["checks"] if check["name"] == "hover_preview"]
        self.assertEqual([check["status"] for check in previews], ["failed", "passed"])
        self.assertEqual(result["status"], "failed")
        self.assertTrue(any(check["name"] == "annotations_removed" and check["status"] == "passed" for check in result["checks"]))
        browser.set_enabled.assert_called_with(False)


if __name__ == "__main__":
    unittest.main()
