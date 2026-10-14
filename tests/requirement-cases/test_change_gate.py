"""Incoming scope and native independent review reject misleading declarations."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/adlc"))
from change_gate import check_reviews, check_scope
import test_task_contract as fixtures


class IncomingChangeTests(unittest.TestCase):
    setUp = fixtures.TaskContractTests.setUp
    run_git = fixtures.TaskContractTests.run_git
    def prepare(self):
        import json
        folder = self.root / "work-items/agent-tasks"
        folder.mkdir(parents=True)
        (folder / "task.json").write_text(json.dumps(self.task))
        (folder / "change-selection.json").write_text(json.dumps({"schema_version": 1, "tasks": ["work-items/agent-tasks/task.json"]}))
        self.run_git("add", ".")
        self.run_git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "task")

    def test_incoming_diff_in_detached_checkout_and_external_branch(self):
        self.prepare()
        self.run_git("checkout", "--detach")
        report = check_scope(self.root, self.task["base_commit"], "HEAD", "codex/test")
        self.assertIn("work-items/agent-tasks/task.json", report["changed_paths"])
        with self.assertRaisesRegex(ValueError, "event branch"):
            check_scope(self.root, self.task["base_commit"], "HEAD", "other")

    def test_event_base_cannot_hide_out_of_scope_committed_change(self):
        self.prepare()
        (self.root / "outside.txt").write_text("change")
        self.run_git("add", ".")
        self.run_git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "outside")
        with self.assertRaisesRegex(ValueError, "outside task scope"):
            check_scope(self.root, self.task["base_commit"], "HEAD")


class IndependentReviewTests(unittest.TestCase):
    def setUp(self):
        self.review = {"id": 1, "user": {"login": "reviewer", "type": "User"},
                       "author_association": "COLLABORATOR", "state": "APPROVED", "commit_id": "a" * 40}

    def test_exact_head_independent_approval_passes(self):
        self.assertEqual(check_reviews([self.review], "a" * 40, "implementer")[0]["reviewer"], "reviewer")

    def test_missing_stale_bot_self_and_untrusted_reviews_fail(self):
        variants = [[], [{**self.review, "commit_id": "b" * 40}],
                    [{**self.review, "user": {"login": "reviewer", "type": "Bot"}}],
                    [{**self.review, "user": {"login": "implementer", "type": "User"}}],
                    [{**self.review, "author_association": "NONE"}]]
        for reviews in variants:
            with self.subTest(reviews=reviews), self.assertRaises(ValueError):
                check_reviews(reviews, "a" * 40, "implementer")

    def test_latest_disposition_and_unresolved_findings_block(self):
        changed = {**self.review, "id": 2, "state": "CHANGES_REQUESTED"}
        with self.assertRaisesRegex(ValueError, "unresolved"):
            check_reviews([self.review, changed], "a" * 40, "implementer")
        self.assertTrue(check_reviews([changed, {**self.review, "id": 3}], "a" * 40, "implementer"))
