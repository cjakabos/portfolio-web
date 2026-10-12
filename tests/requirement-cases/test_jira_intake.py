"""Exercise the live intake through its CLI with a deterministic HTTPS boundary."""

from contextlib import redirect_stderr, redirect_stdout
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import ssl
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/requirements"))
import intake_jira


class LiveJiraIntakeTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "requirements").mkdir()
        self.requirement = self.root / "requirements/REQ-IDENTITY-001.md"
        shutil.copyfile(ROOT / "requirements/REQ-IDENTITY-001.md", self.requirement)
        self.baseline = self.requirement.read_bytes()
        self.settings = {
            "JIRA_INTAKE_URL": "https://jira.example.invalid",
            "JIRA_INTAKE_EMAIL": "reader@example.invalid",
            "JIRA_INTAKE_API_TOKEN": "synthetic-test-token",
        }
        self.payload = {
            "key": "PROJECT-42",
            "fields": {
                "summary": "Refine an existing requirement",
                "description": {
                    "type": "doc",
                    "content": [{"type": "paragraph", "content": [
                        {"type": "text", "text": "Review the proposed change."}
                    ]}],
                },
                "labels": ["REQ-IDENTITY-001"],
                "issuetype": {"name": "Story"},
                "status": {"name": "Open"},
            },
        }

    def run_intake(self, opener, *extra):
        output, errors = io.StringIO(), io.StringIO()
        argv = ["intake_jira.py", "--root", str(self.root), "--source", "jira",
                "--issue", "PROJECT-42", *extra]
        with patch.dict(os.environ, self.settings, clear=True), \
                patch.object(sys, "argv", argv), \
                patch("jira_sources.build_opener", return_value=opener) as factory, \
                redirect_stdout(output), redirect_stderr(errors):
            status = intake_jira.main()
        return status, output.getvalue(), errors.getvalue(), factory

    def response_opener(self):
        raw = json.dumps(self.payload).encode()
        opener = Mock()
        opener.open.return_value = io.BytesIO(raw)
        return opener, raw

    def test_cloud_get_renders_fingerprints_and_deduplicated_requirement_links(self):
        self.settings["JIRA_INTAKE_REQUIREMENTS_FIELD"] = "customfield_12345"
        self.settings["JIRA_INTAKE_CLOUD_ID"] = "00000000-0000-0000-0000-000000000001"
        self.payload["fields"]["customfield_12345"] = [{"value": "REQ-IDENTITY-001"}]
        opener, raw = self.response_opener()
        status, output, errors, factory = self.run_intake(opener)
        self.assertEqual(status, 0, errors)
        opener.open.assert_called_once()
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(urlsplit(request.full_url).path,
                         "/ex/jira/00000000-0000-0000-0000-000000000001/rest/api/3/issue/PROJECT-42")
        fields = parse_qs(urlsplit(request.full_url).query)["fields"][0]
        self.assertIn("customfield_12345", fields)
        expected = base64.b64encode(b"reader@example.invalid:synthetic-test-token").decode()
        self.assertEqual(request.get_header("Authorization"), "Basic " + expected)
        tls = factory.call_args.args[1]._context
        self.assertEqual(tls.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(tls.check_hostname)
        snapshot = (self.root / "work-items/PROJECT-42.md").read_text()
        for text in ("Read-only Jira snapshot", "Review the proposed change.",
                     "../requirements/REQ-IDENTITY-001.md", "AC-REQ-IDENTITY-001-01",
                     hashlib.sha256(raw).hexdigest(), hashlib.sha256(self.baseline).hexdigest()):
            self.assertIn(text, snapshot)
        self.assertEqual(snapshot.count("- [REQ-IDENTITY-001"), 1)
        self.assertNotIn("synthetic-test-token", snapshot + output + errors)
        self.assertEqual(self.requirement.read_bytes(), self.baseline)

    def test_data_center_bearer_token_file_and_plain_description(self):
        token_file = self.root / "token"
        token_file.write_text("synthetic-file-token\n")
        self.settings.pop("JIRA_INTAKE_API_TOKEN")
        self.settings.pop("JIRA_INTAKE_EMAIL")
        self.settings.update(JIRA_INTAKE_AUTH="bearer", JIRA_INTAKE_API_TOKEN_FILE=str(token_file))
        self.payload["fields"]["description"] = "Plain Jira description"
        opener, _ = self.response_opener()
        status, output, errors, _ = self.run_intake(opener, "--output-dir", "work-items/preview")
        self.assertEqual(status, 0, errors)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(urlsplit(request.full_url).path, "/rest/api/2/issue/PROJECT-42")
        self.assertEqual(request.get_header("Authorization"), "Bearer synthetic-file-token")
        snapshot = (self.root / "work-items/preview/PROJECT-42.md").read_text()
        self.assertIn("../../requirements/REQ-IDENTITY-001.md", snapshot)
        self.assertIn("Plain Jira description", snapshot)
        self.assertNotIn("synthetic-file-token", snapshot + output + errors)
        self.assertEqual(self.requirement.read_bytes(), self.baseline)

    def test_access_errors_and_redirects_do_not_write_or_expose_response_data(self):
        for code in (401, 403, 404, 302):
            with self.subTest(code=code):
                opener = Mock()
                opener.open.side_effect = HTTPError(
                    self.settings["JIRA_INTAKE_URL"], code, "synthetic-test-token", {},
                    io.BytesIO(b"confidential response body"))
                status, output, errors, _ = self.run_intake(opener)
                self.assertEqual(status, 2)
                opener.open.assert_called_once()
                self.assertFalse((self.root / "work-items/PROJECT-42.md").exists())
                self.assertNotIn("synthetic-test-token", output + errors)
                self.assertNotIn("confidential response body", output + errors)
                self.assertEqual(self.requirement.read_bytes(), self.baseline)

    def test_existing_human_snapshot_is_preserved_before_any_get(self):
        opener, _ = self.response_opener()
        snapshot = self.root / "work-items/PROJECT-42.md"
        snapshot.parent.mkdir()
        snapshot.write_text("Human refinement")
        status, _, errors, factory = self.run_intake(opener)
        self.assertEqual(status, 2)
        self.assertIn("Refusing to overwrite", errors)
        factory.assert_not_called()
        opener.open.assert_not_called()
        self.assertEqual(snapshot.read_text(), "Human refinement")


if __name__ == "__main__":
    unittest.main()
