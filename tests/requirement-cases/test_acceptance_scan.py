"""CI discovers new requirements without a hand-maintained selection list.

All acceptance decisions constructed here are synthetic disposable fixtures.
They never alter the repository's actual requirement decisions or baseline.
"""
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import unittest

import yaml
import test_traceability as fixtures
from model import parse_requirement
from validate_traceability import validate


class AcceptanceScanTests(unittest.TestCase):
    setUp = fixtures.TraceabilityValidatorTests.setUp
    write_map = fixtures.TraceabilityValidatorTests.write_map
    refresh_requirement_revisions = fixtures.TraceabilityValidatorTests.refresh_requirement_revisions
    record_acceptance = fixtures.TraceabilityValidatorTests.record_acceptance

    def add_requirement(self, identity="REQ-NEW-001", status="proposed"):
        source = self.root / "requirements" / f"{identity}.md"
        source.write_text(fixtures.DOCUMENT.replace("REQ-TEST-001", identity)
                          .replace("status: proposed", f"status: {status}"))
        self.mapping["cases"][f"AC-{identity}-01"] = json.loads(json.dumps(
            self.mapping["cases"]["AC-REQ-TEST-001-01"]))
        self.refresh_requirement_revisions()
        return source

    def command(self, *args):
        return subprocess.run([
            sys.executable, str(fixtures.SCRIPTS / "validate_traceability.py"),
            "--root", str(self.root), *args,
        ], capture_output=True, text=True)

    def test_new_unselected_proposal_fails_ci_scan(self):
        self.record_acceptance()
        self.add_requirement()
        # This was the gap: an old accepted baseline was enough even after
        # generated artifacts and mappings included an unaccepted new document.
        self.assertEqual(validate(self.root, require_accepted_baseline=True)[0], [])
        errors, report = validate(self.root, require_all_accepted=True)
        self.assertTrue(any("REQ-NEW-001: CI requires accepted intent" in error for error in errors))
        self.assertEqual(report["intent"]["counts"], {"accepted": 1, "proposed": 1})

    def test_status_flag_without_recorded_decision_fails_ci_scan(self):
        self.record_acceptance()
        self.add_requirement(status="accepted")
        errors, _ = validate(self.root, require_all_accepted=True)
        self.assertTrue(any("REQ-NEW-001: accepted requirement has no recorded baseline revision" in error for error in errors))

    def test_changed_revision_requires_matching_human_decision(self):
        self.record_acceptance()
        self.source.write_text(self.source.read_text().replace("visible", "persisted"))
        self.refresh_requirement_revisions()
        self.assertTrue(any("accepted revision changed" in error for error in
                            validate(self.root, require_all_accepted=True)[0]))
        # Updating only the baseline cannot renew the fixture human decision.
        self.baseline["requirements"]["REQ-TEST-001"]["digest"] = parse_requirement(self.source).digest
        self.baseline_path.write_text(json.dumps(self.baseline))
        self.assertTrue(any("human decision record" in error for error in
                            validate(self.root, require_all_accepted=True)[0]))

    def test_every_active_revision_with_matching_acceptance_passes(self):
        self.record_acceptance()
        source = self.add_requirement(status="accepted")
        review_path = "requirements/reviews/NEW-FIXTURE.md"
        source.write_text(source.read_text().replace("owner: maintainers",
                                                    f"owner: maintainers\nreview: {review_path}"))
        digest = parse_requirement(source).digest
        (self.root / review_path).write_text(
            '---\nschema_version: 1\nid: NEW-FIXTURE\nstatus: accepted\n'
            'decided_by: fixture-reviewer\ndecided_on: "2026-10-12"\n'
            'requirements: [REQ-NEW-001]\nrequirement_digests:\n'
            f'  REQ-NEW-001: {digest}\n---\n\nSynthetic test decision only.\n')
        self.baseline["requirements"]["REQ-NEW-001"] = {
            "digest": digest, "accepted_by": "fixture-reviewer", "accepted_on": "2026-10-12",
            "decision": review_path,
        }
        self.baseline_path.write_text(json.dumps(self.baseline))
        self.refresh_requirement_revisions()
        self.assertEqual(validate(self.root, require_all_accepted=True)[0], [])
        self.assertEqual(self.command("--require-all-accepted").returncode, 0)

    def test_cli_strict_mode_reports_unaccepted_requirement_and_requires_baseline(self):
        report = self.root / "report.json"
        result = self.command("--require-all-accepted", "--report", str(report))
        self.assertNotEqual(result.returncode, 0)
        errors = json.loads(report.read_text())["errors"]
        self.assertTrue(any("REQ-TEST-001: CI requires accepted intent" in error for error in errors))
        self.assertTrue(any("baseline.json" in error for error in errors))

    def test_draft_generation_and_source_validation_remain_available(self):
        self.assertEqual(validate(self.root)[0], [])
        result = subprocess.run([
            sys.executable, str(fixtures.SCRIPTS / "generate_cases.py"),
            "--root", str(self.root), "--check",
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_retired_documents_are_not_active_requirements(self):
        self.record_acceptance()
        retired = fixtures.DOCUMENT.replace("REQ-TEST-001", "REQ-RETIRED-001")
        retired = retired.replace("status: proposed", "status: retired").split("```gherkin")[0]
        (self.root / "requirements/REQ-RETIRED-001.md").write_text(retired)
        self.refresh_requirement_revisions()
        errors, report = validate(self.root, require_all_accepted=True)
        self.assertEqual(errors, [])
        self.assertEqual(report["intent"]["counts"], {"retired": 1, "accepted": 1})

    def test_actual_compose_validation_command_rejects_new_unselected_proposal(self):
        self.record_acceptance()
        self.add_requirement()
        compose = yaml.safe_load((fixtures.ROOT / "docker-compose.test.yml").read_text())
        entrypoint = compose["services"]["test-requirements"]["entrypoint"][-1]
        invocation = re.search(r"python3 scripts/requirements/validate_traceability.py ([^;]+)", entrypoint)
        self.assertIsNotNone(invocation)
        args = shlex.split(invocation.group(1))
        args[args.index("--report") + 1] = str(self.root / "ci-report.json")
        result = self.command(*args)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REQ-NEW-001: CI requires accepted intent", result.stderr)
