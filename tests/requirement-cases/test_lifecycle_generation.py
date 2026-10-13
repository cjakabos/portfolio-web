"""Execute the bounded lifecycle replay and verify its failure semantics."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("rehearse_generation", ROOT / "scripts/adlc/rehearse_generation.py")
replay = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(replay)


class LifecycleGenerationTests(unittest.TestCase):
    def test_real_generation_rejects_missing_artifact_and_recovers_without_source_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "run.json"
            report = replay.rehearse(output=output)
            self.assertEqual(report["status"], "passed")
            self.assertEqual([step["exit_code"] for step in report["steps"]], [0, 0, 2, 0, 0])
            self.assertTrue(report["canonical_inputs_unchanged"])
            self.assertTrue(report["rollback_equivalence"])
            self.assertTrue(report["temporary_workspace_removed"])
            self.assertIn("REQ-HARNESS-001.feature", report["generated_artifacts"])
            self.assertEqual(json.loads(output.read_text())["status"], "passed")

    def test_stale_task_intent_invalidates_prior_success(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            task = json.loads(replay.TASK.read_text())
            task["requirements"][0]["digest"] = "0" * 64
            task_path = folder / "task.json"
            task_path.write_text(json.dumps(task))
            output = folder / "run.json"
            output.write_text('{"status":"passed"}')
            with self.assertRaises(ValueError):
                replay.rehearse(task_path=task_path, output=output)
            self.assertEqual(json.loads(output.read_text())["status"], "failed")

    def test_unexpected_generator_failure_is_never_success(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "run.json"
            with patch.object(replay.subprocess, "run", return_value=type("Result", (), {
                "returncode": 1, "stdout": "", "stderr": "deterministic failure"})()):
                with self.assertRaises(RuntimeError):
                    replay.rehearse(output=output)
            report = json.loads(output.read_text())
            self.assertEqual(report["status"], "failed")
            self.assertEqual(report["steps"][0]["exit_code"], 1)


if __name__ == "__main__":
    unittest.main()
