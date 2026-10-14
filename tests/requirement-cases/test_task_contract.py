"""Coding-agent authority failures reject work without executing task commands."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("task_contract", ROOT / "scripts/adlc/task_contract.py")
contract = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contract)


class TaskContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.task = json.loads((ROOT / "work-items/agent-tasks/ADLC-2026-10-13.json").read_text())
        for name in ("requirements/baseline.json", "tests/requirement-cases/generated/index.json",
                     *(str(path.relative_to(ROOT)) for path in (ROOT / "requirements").glob("REQ-*.md")),
                     *(str(path.relative_to(ROOT)) for path in (ROOT / "requirements/reviews").glob("*.md"))):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.run_git("init", "-b", "codex/test")
        self.run_git("add", ".")
        self.run_git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture")
        self.task["branch"] = "codex/test"
        self.task["base_commit"] = self.run_git("rev-parse", "HEAD").strip()

    def run_git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True, stderr=subprocess.DEVNULL)

    def test_valid_task_and_diff_do_not_execute_declared_commands(self):
        self.task["checks"] = [{"argv": ["touch", "should-not-exist"], "purpose": "Never executed by validation"}]
        self.assertEqual(contract.validate(self.task, self.root, True), "ADLC-2026-10-13")
        self.assertFalse((self.root / "should-not-exist").exists())

    def test_missing_or_draft_authority_is_rejected(self):
        for key in ("approved_by", "source"):
            bad = copy.deepcopy(self.task)
            bad["authority"][key] = ""
            with self.assertRaises(ValueError):
                contract.validate(bad, self.root)
        self.task["authority"]["status"] = "draft"
        with self.assertRaisesRegex(ValueError, "recorded human approval"):
            contract.validate(self.task, self.root)

    def test_live_credentials_network_and_external_mutations_are_rejected(self):
        for change in ({"credentials": {"mode": "live", "references": ["JIRA_TOKEN"]}},
                       {"network": {"dependency_downloads": True, "live_services": ["https://jira.example"]}},
                       {"allowed_actions": ["external-mutations"]}):
            bad = copy.deepcopy(self.task)
            bad["authority"].update(change)
            with self.assertRaises(ValueError):
                contract.validate(bad, self.root)

    def test_stale_accepted_intent_and_unknown_scenario_are_rejected(self):
        self.task["requirements"][0]["digest"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "accepted revision"):
            contract.validate(self.task, self.root)
        self.task["requirements"][0]["digest"] = json.loads((self.root / "requirements/baseline.json").read_text())["requirements"]["REQ-HARNESS-001"]["digest"]
        self.task["requirements"][0]["scenario_ids"] = ["AC-REQ-HARNESS-001-99"]
        with self.assertRaisesRegex(ValueError, "unknown requirement scenario"):
            contract.validate(self.task, self.root)

    def test_required_untrusted_input_escalation_and_independent_review_cannot_be_omitted(self):
        for modify in (lambda task: task["authority"]["untrusted_inputs"].pop(),
                       lambda task: task["escalation"].pop(),
                       lambda task: task["review"].update(independent=False)):
            bad = copy.deepcopy(self.task)
            modify(bad)
            with self.assertRaises(ValueError):
                contract.validate(bad, self.root)

    def test_absolute_parent_git_and_escaping_symlink_scopes_are_rejected(self):
        (self.root / "escape").symlink_to(self.root.parent, target_is_directory=True)
        (self.root / "git-alias").symlink_to(self.root / ".git", target_is_directory=True)
        for scope in ("/tmp", "../outside", ".git/config", "git-alias/config", "escape/file", "."):
            bad = copy.deepcopy(self.task)
            bad["authority"]["write_paths"] = [scope]
            with self.assertRaises(ValueError):
                contract.validate(bad, self.root)

    def test_untracked_out_of_scope_changes_and_directory_prefix_collisions_are_rejected(self):
        for filename in ("unexpected.md", "scripts/adlc-other/file.py", " scripts/adlc/outside.py"):
            path = self.root / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("untrusted data")
            with self.assertRaisesRegex(ValueError, "outside approved scope"):
                contract.validate(self.task, self.root, True)
            path.unlink()

    def test_wrong_branch_or_missing_base_fails_closed(self):
        bad = copy.deepcopy(self.task)
        bad["branch"] = "other"
        with self.assertRaisesRegex(ValueError, "task branch"):
            contract.validate(bad, self.root, True)
        self.task["base_commit"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "comparison unavailable"):
            contract.validate(self.task, self.root, True)

    def test_staged_out_of_scope_content_cannot_hide_behind_restored_working_bytes(self):
        baseline = self.root / "requirements/baseline.json"
        original = baseline.read_text()
        baseline.write_text(original + "\n")
        self.run_git("add", "requirements/baseline.json")
        baseline.write_text(original)
        with self.assertRaisesRegex(ValueError, "outside approved scope"):
            contract.validate(self.task, self.root, True)

    def test_missing_human_decision_is_not_accepted_task_intent(self):
        shutil.rmtree(self.root / "requirements/reviews")
        with self.assertRaisesRegex(ValueError, "invalid accepted product intent"):
            contract.validate(self.task, self.root)

    def test_read_only_task_cannot_pass_with_file_edits(self):
        (self.root / "README.md").write_text("change")
        self.task["authority"]["allowed_actions"] = ["read-repository"]
        with self.assertRaisesRegex(ValueError, "does not permit file edits"):
            contract.validate(self.task, self.root, True)

    def test_duplicate_json_and_unknown_fields_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            json.loads('{"source":"human","source":"model"}', object_pairs_hook=contract.unique_object)
        self.task["self_approved"] = True
        with self.assertRaisesRegex(ValueError, "expected fields"):
            contract.validate(self.task, self.root)

    def test_authority_records_and_policy_changes_invalidate_execution_context(self):
        from record_execution import context
        # The temporary intent fixture needs the same coverage-input structure.
        (self.root / "requirements/test-map.json").write_text('{"cases":{}}')
        policy = self.root / "AGENTS.md"
        policy.write_text("original policy")
        tasks = self.root / "work-items/agent-tasks"
        tasks.mkdir(parents=True)
        task = tasks / "task.json"
        task.write_text(json.dumps(self.task))
        before = context(self.root)
        policy.write_text("changed policy")
        self.assertNotEqual(before, context(self.root))
        before = context(self.root)
        task.write_text(json.dumps({**self.task, "objective": "changed scope"}))
        self.assertNotEqual(before, context(self.root))


if __name__ == "__main__":
    unittest.main()
