"""Reproduce snapshot revision bypasses against real temporary Git history."""
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("openapi_contracts", ROOT / "scripts/contracts/openapi_contracts.py")
contracts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contracts)


class ContractRevisionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.snapshots = self.root / "contracts/openapi"
        self.snapshots.mkdir(parents=True)
        self.manifest_path = self.snapshots / "manifest.json"
        self.snapshot = {"openapi": "3.0.1", "info": {"title": "Example API", "version": "v1"}, "paths": {}}
        self.manifest = {"schemaVersion": 1, "services": {"example": {
            "owner": "fixture", "releaseCritical": True, "sourceTitle": "Example API", "upstreamVersion": "v1", "snapshotRevision": 1}}}
        self.save()
        self.run_git("init", "-b", "fixture")
        self.commit()
        self.base = self.run_git("rev-parse", "HEAD").strip()

    def run_git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True, stderr=subprocess.DEVNULL)

    def commit(self, message="fixture"):
        self.run_git("add", ".")
        self.run_git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", message)

    def save(self):
        (self.snapshots / "example.json").write_text(json.dumps(self.snapshot, indent=2)+"\n")
        self.manifest_path.write_text(json.dumps(self.manifest, indent=2)+"\n")

    def check(self, base=None):
        output = io.StringIO()
        with redirect_stdout(output), redirect_stderr(output):
            result = contracts.check_snapshot_revisions(self.root, self.snapshots, self.manifest_path, base or self.base)
        return result, output.getvalue()

    def test_changed_snapshot_passes_old_manifest_check_but_fails_revision_gate(self):
        self.snapshot["paths"]["/new"] = {"get": {"operationId": "new", "responses": {"200": {"description": "OK"}}}}
        self.save()
        self.assertEqual(contracts.validate_contract_manifest(self.snapshots, self.manifest_path)[1], 0)
        self.assertEqual(self.check()[0], 1)
        self.assertIn("must be greater than 1", self.check()[1])
        self.manifest["services"]["example"]["snapshotRevision"] = 2
        self.save()
        self.assertEqual(self.check()[0], 0)

    def test_metadata_or_formatting_changes_require_a_bump_without_upstream_version_change(self):
        (self.snapshots / "example.json").write_text(json.dumps(self.snapshot))
        self.assertEqual(self.check()[0], 1)
        self.snapshot["info"]["description"] = "Updated contract explanation"
        self.save()
        self.assertEqual(self.check()[0], 1)

    def test_unchanged_snapshot_passes_and_revision_cannot_decrease(self):
        self.assertEqual(self.check()[0], 0)
        self.manifest["services"]["example"]["snapshotRevision"] = 3
        self.save()
        self.commit()
        self.base = self.run_git("rev-parse", "HEAD").strip()
        self.manifest["services"]["example"]["snapshotRevision"] = 2
        self.save()
        self.assertEqual(self.check()[0], 1)

    def test_new_service_starts_at_one_and_removal_cannot_bypass_gate(self):
        (self.snapshots / "another.json").write_text(json.dumps(self.snapshot))
        self.manifest["services"]["another"] = dict(self.manifest["services"]["example"], snapshotRevision=2)
        self.save()
        self.assertEqual(self.check()[0], 1)
        self.manifest["services"]["another"]["snapshotRevision"] = 1
        self.save()
        self.assertEqual(self.check()[0], 0)
        (self.snapshots / "example.json").unlink()
        del self.manifest["services"]["example"]
        self.manifest_path.write_text(json.dumps(self.manifest))
        self.assertEqual(self.check()[0], 1)
        self.assertIn("retirement policy", self.check()[1])

    def test_missing_and_non_ancestor_bases_fail_closed(self):
        self.assertEqual(self.check("0" * 40)[0], 1)
        self.run_git("checkout", "--orphan", "unrelated")
        self.commit("distinct orphan fixture")
        self.assertEqual(self.check()[0], 1)

    def test_directory_symlink_cannot_reclassify_changed_snapshots_as_new(self):
        import shutil
        replacement = self.root / "contracts/replacement"
        shutil.copytree(self.snapshots, replacement)
        changed = dict(self.snapshot, paths={"/new": {"get": {"responses": {"200": {"description": "OK"}}}}})
        (replacement / "example.json").write_text(json.dumps(changed))
        shutil.rmtree(self.snapshots)
        self.snapshots.symlink_to(replacement, target_is_directory=True)
        self.assertEqual(self.check()[0], 1)
        self.assertIn("symlink aliases", self.check()[1])

    def test_boolean_revision_and_broken_base_manifest_are_rejected(self):
        self.manifest["services"]["example"]["snapshotRevision"] = True
        self.save()
        self.assertEqual(self.check()[0], 1)
        self.manifest_path.unlink()
        self.commit()
        self.base = self.run_git("rev-parse", "HEAD").strip()
        self.manifest["services"]["example"]["snapshotRevision"] = 2
        self.save()
        self.assertEqual(self.check()[0], 1)

    def test_cli_requires_base_and_reports_missing_history(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/contracts/openapi_contracts.py"), "check-revisions"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        result = subprocess.run([sys.executable, str(ROOT / "scripts/contracts/openapi_contracts.py"), "check-revisions",
            "--base-ref", "0" * 40, "--repo-root", str(self.root), "--snapshot-dir", str(self.snapshots), "--manifest-path", str(self.manifest_path)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)

    def test_ci_uses_full_history_and_event_derived_base_before_live_services(self):
        import yaml
        job = yaml.safe_load((ROOT / ".github/workflows/ci-tests.yml").read_text())["jobs"]["api-contract-tests"]
        checkout = next(step for step in job["steps"] if step.get("uses", "").startswith("actions/checkout@"))
        self.assertEqual(checkout["with"]["fetch-depth"], 0)
        gate = next(step for step in job["steps"] if step.get("name") == "Enforce contract revision increases")
        self.assertEqual(gate["env"]["PR_BASE"], "${{ github.event.pull_request.base.sha }}")
        self.assertEqual(gate["env"]["PUSH_BASE"], "${{ github.event.before }}")
        self.assertLess(job["steps"].index(gate), next(i for i, step in enumerate(job["steps"]) if step.get("name") == "Start backend services"))


if __name__ == "__main__":
    unittest.main()
