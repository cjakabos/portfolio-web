"""Run the actual workflow authority step with synthetic credentials only."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]


class LiveJiraAuthorityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.safe_load((ROOT / ".github/workflows/nightly-ai-integrations.yml").read_text())
        cls.steps = cls.workflow["jobs"]["nightly-ai-e2e"]["steps"]
        cls.gate = next(step for step in cls.steps if step.get("id") == "jira")

    def run_gate(self, requested="false", **overrides):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "output"
            env = {**os.environ, "GITHUB_OUTPUT": str(output), "REQUEST_READ_ONLY": requested,
                   "JIRA_DOMAIN": "https://fixture.invalid", "JIRA_EMAIL": "fixture@example.invalid",
                   "JIRA_API_TOKEN": "synthetic-secret", "JIRA_PROJECT_KEY": "FIXTURE", **overrides}
            result = subprocess.run(["bash", "-c", self.gate["run"]], env=env, text=True, capture_output=True)
            text = output.read_text() if output.exists() else ""
            self.assertNotIn("synthetic-secret", text + result.stdout + result.stderr)
            return result, text

    def test_credentials_alone_never_enable_live_jira(self):
        for requested in ("false", "", "1", "approve-all"):
            result, output = self.run_gate(requested)
            self.assertEqual(result.returncode, 0)
            self.assertIn("enabled=0", output)
            self.assertNotIn("enabled=1", output)

    def test_explicit_read_only_opt_in_emits_only_fixture_target(self):
        result, output = self.run_gate("true")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(output, "enabled=1\nproject_key=FIXTURE\n")

    def test_missing_credentials_or_invalid_target_reject_requested_run(self):
        for key in ("JIRA_DOMAIN", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"):
            result, output = self.run_gate("true", **{key: ""})
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("enabled=1", output)
        for target in ("FIXTURE\nenabled=1", "FIXTURE&project=OTHER", "../OTHER"):
            result, output = self.run_gate("true", JIRA_PROJECT_KEY=target)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("enabled=1", output)

    def test_manual_default_and_secret_injection_are_read_only_and_opt_in(self):
        trigger = self.workflow.get("on", self.workflow.get(True))
        option = trigger["workflow_dispatch"]["inputs"]["jira_read_only"]
        self.assertEqual(option["type"], "boolean")
        self.assertIs(option["default"], False)
        self.assertEqual(self.gate["env"]["REQUEST_READ_ONLY"], "${{ github.event_name == 'workflow_dispatch' && inputs.jira_read_only }}")
        create_env = next(step for step in self.steps if step.get("name") == "Create .env for nightly stack")
        self.assertLess(self.steps.index(self.gate), self.steps.index(create_env))
        for variable in ("JIRA_DOMAIN", "JIRA_EMAIL", "JIRA_API_TOKEN"):
            self.assertIn("steps.jira.outputs.enabled == '1'", create_env["env"][variable])
            self.assertIn("secrets.JIRA_READ_ONLY_", create_env["env"][variable])
        run = next(step for step in self.steps if step.get("name") == "Run nightly AI integration specs")
        guard = next(step for step in self.steps if step.get("name") == "Run Jira authority regressions")
        self.assertLess(self.steps.index(guard), self.steps.index(run))
        self.assertIn("jira-authority.spec.ts", guard["run"])
        self.assertIn("e2e/jira-authority.config.ts", guard["run"])
        self.assertNotIn("NIGHTLY_ENABLE_JIRA_E2E", run["env"])
        self.assertIn("NIGHTLY_ENABLE_JIRA_READ_ONLY_E2E", run["env"])
        self.assertEqual(run["env"]["PW_ADMIN_USERNAME"], "integrationadmin")


if __name__ == "__main__":
    unittest.main()
