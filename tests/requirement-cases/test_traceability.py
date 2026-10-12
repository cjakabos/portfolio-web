"""Docker regression tests for the real intake/generator commands and trace gate."""

from __future__ import annotations
import json
import hashlib
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts/requirements"
sys.path.insert(0, str(SCRIPTS))
from model import artifacts, load_requirements, parse_requirement
from report_results import attach_results, attach_json_results
from record_execution import context, digest
from merge_evidence import merge
from test_sources import declarations
from validate_traceability import validate

DOCUMENT = """---
schema_version: 1
id: REQ-TEST-001
title: Test requirement
status: proposed
owner: maintainers
---

```gherkin
@REQ-TEST-001
Feature: Test feature

  @AC-REQ-TEST-001-01
  Scenario: Test behavior
    Given a valid state
    When the operation runs
    Then its result is visible
```
"""


class RequirementHarnessTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "repo"
        (self.root / "requirements").mkdir(parents=True)
        shutil.copytree(
            ROOT / "requirements", self.root / "requirements", dirs_exist_ok=True
        )
        (self.root / "fixtures/jira").mkdir(parents=True)
        self.issue = {
            "key": "DEMO-42",
            "summary": "Traceable change",
            "source": "synthetic-fixture",
            "url": "https://jira.example.invalid/browse/DEMO-42",
            "requirement_ids": ["REQ-IDENTITY-001"],
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
            "description": "Fixture change",
            "proposed_requirement_change": "Review this delta",
        }
        self.fixture = self.root / "fixtures/jira/DEMO-42.json"
        self.fixture.write_text(json.dumps(self.issue))
        self.guard = Path(self.temporary.name) / "guard"
        self.guard.mkdir()
        (self.guard / "sitecustomize.py").write_text(
            "import sys\ndef guard(event, args):\n    if event.startswith('socket.') and event not in {'socket.__new__'}:\n        raise RuntimeError('intake/generator must not use the network')\nsys.addaudithook(guard)\n"
        )

    def command(self, script, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / script), "--root", str(self.root), *args],
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONPATH": str(self.guard),
            },
        )

    def test_fixture_intake_snapshot_links_requirement_and_cases(self):
        result = self.command("intake_jira.py", "--issue", "DEMO-42")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = (self.root / "work-items/DEMO-42.md").read_text()
        for expected in [
            "DEMO-42",
            self.issue["url"],
            self.issue["updated_at"],
            "Snapshot SHA-256",
            "Baseline SHA-256",
            "REQ-IDENTITY-001",
            "AC-REQ-IDENTITY-001-01",
            "Proposal only",
        ]:
            self.assertIn(expected, output)
        self.assertIn(hashlib.sha256(self.fixture.read_bytes()).hexdigest(), output)
        self.assertIn("network and Jira write operations: none", result.stdout)
        # The subprocess has an empty temporary repository and uses only its fixture.
        self.assertEqual(len(list((self.root / "work-items").glob("*.md"))), 1)

    def test_unknown_requirement_is_rejected(self):
        self.issue["requirement_ids"] = ["REQ-UNKNOWN-999"]
        self.fixture.write_text(json.dumps(self.issue))
        result = self.command("intake_jira.py", "--issue", "DEMO-42")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown requirement ID", result.stderr)
        self.assertFalse((self.root / "work-items").exists())

    def test_proposed_delta_does_not_change_canonical_requirement(self):
        before = {
            path.name: path.read_bytes()
            for path in (self.root / "requirements").glob("REQ-*.md")
        }
        result = self.command("intake_jira.py", "--issue", "DEMO-42")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            before,
            {
                path.name: path.read_bytes()
                for path in (self.root / "requirements").glob("REQ-*.md")
            },
        )
        self.assertIn(
            "Proposal only", (self.root / "work-items/DEMO-42.md").read_text()
        )

    def test_generator_emits_requirement_and_acceptance_ids(self):
        output = Path(self.temporary.name) / "absolute-output"
        result = self.command("generate_cases.py", "--output-dir", str(output))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(list(output.glob("REQ-*.feature"))), 14)
        rendered = (output / "REQ-IDENTITY-001.feature").read_text()
        for expected in [
            "requirements/REQ-IDENTITY-001.md",
            "@AC-REQ-IDENTITY-001-01",
            "Requirement SHA-256",
        ]:
            self.assertIn(expected, rendered)
        self.assertTrue((output / "index.json").exists())
        check = self.command(
            "generate_cases.py", "--output-dir", str(output), "--check"
        )
        self.assertEqual(check.returncode, 0, check.stderr)

    def test_existing_work_item_is_preserved_without_force(self):
        self.assertEqual(
            self.command("intake_jira.py", "--issue", "DEMO-42").returncode, 0
        )
        output = self.root / "work-items/DEMO-42.md"
        output.write_text("human review and PR link")
        self.assertNotEqual(
            self.command("intake_jira.py", "--issue", "DEMO-42").returncode, 0
        )
        self.assertEqual(output.read_text(), "human review and PR link")

    def test_malformed_fixture_does_not_write(self):
        for fixture in [
            [],
            {"key": "DEMO-42"},
            {**self.issue, "requirement_ids": "REQ-IDENTITY-001"},
            {**self.issue, "source": "live-jira"},
        ]:
            self.fixture.write_text(json.dumps(fixture))
            result = self.command("intake_jira.py", "--issue", "DEMO-42")
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("Traceback", result.stderr)
            self.assertFalse((self.root / "work-items").exists())

    def test_check_detects_changes_without_writing(self):
        self.assertEqual(self.command("generate_cases.py").returncode, 0)
        path = self.root / "requirements/REQ-IDENTITY-001.md"
        path.write_text(
            path.read_text().replace(
                "Then the account is not created",
                "Then the account is rejected with a reason",
            )
        )
        output = (
            self.root / "tests/requirement-cases/generated/REQ-IDENTITY-001.feature"
        )
        before = output.read_bytes()
        result = self.command("generate_cases.py", "--check")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), before)

    def test_retired_and_deleted_features_are_removed(self):
        self.assertEqual(self.command("generate_cases.py").returncode, 0)
        retired = self.root / "requirements/REQ-IDENTITY-001.md"
        retired.write_text(
            retired.read_text().replace("status: proposed", "status: retired")
        )
        (self.root / "requirements/REQ-CHAT-001.md").unlink()
        self.assertNotEqual(self.command("generate_cases.py", "--check").returncode, 0)
        self.assertEqual(self.command("generate_cases.py").returncode, 0)
        output = self.root / "tests/requirement-cases/generated"
        self.assertFalse((output / "REQ-IDENTITY-001.feature").exists())
        self.assertFalse((output / "REQ-CHAT-001.feature").exists())
        self.assertEqual(self.command("generate_cases.py", "--check").returncode, 0)


class RequirementSchemaTests(unittest.TestCase):
    def parse(self, text):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "REQ-TEST-001.md"
            path.write_text(text)
            return parse_requirement(path)

    def test_valid_schema_and_stable_digest(self):
        self.assertEqual(
            self.parse(DOCUMENT).cases[0].digest, self.parse(DOCUMENT).cases[0].digest
        )
        self.assertNotEqual(
            self.parse(DOCUMENT).cases[0].digest,
            self.parse(DOCUMENT.replace("visible", "persisted")).cases[0].digest,
        )

    def test_tag_attachment_and_foreign_ids_are_rejected(self):
        bad = [
            DOCUMENT.replace(
                "@AC-REQ-TEST-001-01", "@AC-REQ-TEST-001-01 @AC-REQ-TEST-001-02"
            )
            + "\n",
            DOCUMENT.replace("@AC-REQ-TEST-001-01", "@AC-REQ-OTHER-001-01"),
            DOCUMENT.replace("  @AC-REQ-TEST-001-01\n", ""),
            DOCUMENT.replace("@REQ-TEST-001", "@REQ-TEST-001 @AC-REQ-TEST-001-01"),
            DOCUMENT.replace(
                "@AC-REQ-TEST-001-01", "@AC-REQ-TEST-001-01 @AC-REQ-TEST-001-02"
            ).replace("```\n", "  Scenario: Untagged second\n    Then visible\n```\n"),
        ]
        for text in bad:
            with self.subTest(text=text), self.assertRaises(ValueError):
                self.parse(text)

    def test_duplicate_scenario_ids_are_rejected(self):
        extra = "  @AC-REQ-TEST-001-01\n  Scenario: Second\n    Then another result\n"
        with self.assertRaises(ValueError):
            self.parse(DOCUMENT.replace("```\n", extra + "```\n"))

    def test_multiple_features_and_fences_are_rejected(self):
        for text in [
            DOCUMENT.replace("```\n", "Feature: Second\n```\n"),
            DOCUMENT + "\n```gherkin\nFeature: Second\n```\n",
        ]:
            with self.assertRaises(ValueError):
                self.parse(text)

    def test_metadata_schema_is_strict(self):
        for text in [
            DOCUMENT.replace("schema_version: 1", "schema_version: 2"),
            DOCUMENT.replace("owner: maintainers", "owner: []"),
            DOCUMENT.replace("title: Test requirement", "title: first\ntitle: second"),
            DOCUMENT.replace("status: proposed", "status: invalid"),
        ]:
            with self.assertRaises(ValueError):
                self.parse(text)

    def test_scenario_outline_examples(self):
        valid = DOCUMENT.replace(
            "Scenario: Test behavior", "Scenario Outline: Test behavior"
        ).replace(
            "Then its result is visible",
            "Then <result> is visible\n\n    Examples:\n      | result |\n      | value |",
        )
        self.assertEqual(len(self.parse(valid).cases), 1)
        with self.assertRaises(ValueError):
            self.parse(valid.replace("      | value |\n", ""))
        with self.assertRaises(ValueError):
            self.parse(
                valid.replace("    Examples:", "    @AC-REQ-TEST-001-02\n    Examples:")
            )

    def test_cross_document_id_misuse_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "requirements").mkdir()
            (root / "requirements/REQ-TEST-001.md").write_text(DOCUMENT)
            other = DOCUMENT.replace("id: REQ-TEST-001", "id: REQ-OTHER-001").replace(
                "@REQ-TEST-001", "@REQ-OTHER-001"
            )
            (root / "requirements/REQ-OTHER-001.md").write_text(other)
            with self.assertRaises(ValueError):
                load_requirements(root)


class TraceabilityValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "requirements").mkdir()
        self.source = self.root / "requirements/REQ-TEST-001.md"
        self.source.write_text(DOCUMENT)
        output = self.root / "tests/requirement-cases/generated"
        output.mkdir(parents=True)
        for name, text in artifacts(load_requirements(self.root), self.root).items():
            (output / name).write_text(text)
        (self.root / "tests/requirement-cases/test_example.py").write_text(
            "import unittest\nclass Example(unittest.TestCase):\n    def test_exact(self):\n        self.assertTrue(True)\n"
        )
        (self.root / "docker-compose.test.yml").write_text(
            "services:\n  test-requirements: {}\n  test-all:\n    entrypoint: [sh, '-c', \"SERVICES='test-requirements'\"]\n"
        )
        self.mapping = {
            "schema_version": 2,
            "generated_cases": "tests/requirement-cases/generated",
            "cases": {
                "AC-REQ-TEST-001-01": {
                    "case_digest": parse_requirement(self.source).cases[0].digest,
                    "coverage": "complete",
                    "gap": "",
                    "owner": "maintainers",
                    "targets": [
                        {
                            "path": "tests/requirement-cases/test_example.py",
                            "test_id": "Example.test_exact",
                            "suite": "test-requirements",
                            "execution": "default",
                            "asserts": "expected outcome",
                        }
                    ],
                }
            },
        }
        self.map_path = self.root / "requirements/test-map.json"
        self.write_map()

    def write_map(self):
        self.map_path.write_text(json.dumps(self.mapping))

    def test_source_validation_does_not_claim_execution(self):
        errors, report = validate(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(
            report["cases"]["AC-REQ-TEST-001-01"]["tests"][0]["outcome"], "not-run"
        )

    def test_stale_canonical_text_and_review_digest_fail(self):
        self.source.write_text(DOCUMENT.replace("visible", "persisted"))
        errors, _ = validate(self.root)
        self.assertTrue(any("stale" in error for error in errors))
        self.assertTrue(any("case revision changed" in error for error in errors))

    def test_deleted_requirement_fails(self):
        self.source.unlink()
        self.assertTrue(validate(self.root)[0])

    def test_added_scenario_missing_mapping_fails(self):
        self.source.write_text(
            DOCUMENT.replace(
                "```\n",
                "  @AC-REQ-TEST-001-02\n  Scenario: Second\n    Then visible\n```\n",
            )
        )
        self.assertTrue(
            any("no test mapping" in error for error in validate(self.root)[0])
        )

    def test_generic_comment_and_renamed_test_selectors_fail(self):
        target = self.mapping["cases"]["AC-REQ-TEST-001-01"]["targets"][0]
        source = self.root / target["path"]
        source.write_text(
            source.read_text() + "\n# Example.test_fake exists only in a comment\n"
        )
        for name in ["test_", "Example.test_fake", "Example.test_renamed"]:
            target["test_id"] = name
            self.write_map()
            self.assertTrue(
                any(
                    "exact test declaration" in error
                    for error in validate(self.root)[0]
                )
            )

    def test_invalid_suite_execution_and_gap_fail(self):
        entry = self.mapping["cases"]["AC-REQ-TEST-001-01"]
        entry["targets"][0]["suite"] = "test-e2e"
        self.write_map()
        self.assertTrue(validate(self.root)[0])
        entry["targets"][0]["suite"] = "test-requirements"
        entry["targets"][0]["execution"] = "unknown"
        self.write_map()
        self.assertTrue(validate(self.root)[0])
        entry["targets"][0]["execution"] = "default"
        entry["coverage"] = "partial"
        self.write_map()
        self.assertTrue(validate(self.root)[0])

    def test_missing_coverage_is_explicit_and_valid(self):
        entry = self.mapping["cases"]["AC-REQ-TEST-001-01"]
        entry.update(coverage="missing", gap="No behavior test exists.", targets=[])
        self.write_map()
        self.assertEqual(validate(self.root)[0], [])

    def test_duplicate_json_keys_fail(self):
        self.map_path.write_text('{"schema_version": 2, "schema_version": 2}')
        self.assertTrue(
            any("duplicate JSON key" in error for error in validate(self.root)[0])
        )

    def test_java_and_typescript_comments_are_not_tests(self):
        for name, text, expected in [
            (
                "Test.java",
                "class Test { /* @Test void fake() {} */ @Test void real() {} }",
                {"Test.real"},
            ),
            (
                "test.ts",
                '// test("fake", () => {});\nconst text = "test(\\"fake\\")";\ntest("real", () => {});',
                {"real"},
            ),
        ]:
            path = self.root / name
            path.write_text(text)
            self.assertEqual(declarations(path), expected)

    def test_xml_outcomes_are_exact_and_skips_do_not_pass(self):
        _, report = validate(self.root)
        target = report["cases"]["AC-REQ-TEST-001-01"]["tests"][0]
        xml = self.root / "results.xml"
        xml.write_text(
            '<testsuite><testcase classname="test_example.Example" name="test_other"/></testsuite>'
        )
        attach_results(report, "test-requirements", [xml])
        self.assertEqual(target["outcome"], "not-run")
        for content, outcome in [
            ("<skipped/>", "skipped"),
            ("<failure/>", "failed"),
            ("", "passed"),
        ]:
            xml.write_text(
                f'<testsuite><testcase classname="test_example.Example" name="test_exact">{content}</testcase></testsuite>'
            )
            attach_results(report, "test-requirements", [xml])
            self.assertEqual(target["outcome"], outcome)
        xml.write_text("<testsuite/>")
        attach_results(report, "test-requirements", [xml])
        self.assertEqual(target["outcome"], "not-run")

    def test_result_report_rejects_another_checkout_context(self):
        _, report = validate(self.root)
        report_path = self.root / "report.json"
        report_path.write_text(json.dumps(report))
        context_path = self.root / "context.json"
        context_path.write_text("{}")
        xml = self.root / "result.xml"
        xml.write_text("<testsuite/>")
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "report_results.py"),
                "--report",
                str(report_path),
                "--suite",
                "test-requirements",
                "--junit",
                str(xml),
                "--context",
                str(context_path),
            ],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match", result.stderr)

    def test_json_results_match_file_and_exact_title_and_reset_missing_results(self):
        target = {"path": "frontend/cloudapp-shell/src/__tests__/example.test.tsx",
                  "test_id": "renders a result", "suite": "test-frontend-unit"}
        report = {"cases": {"example": {"tests": [target]}}}
        output = self.root / "jest.json"
        def attach(name, title, status):
            output.write_text(json.dumps({"testResults": [{"name": name,
                "assertionResults": [{"title": title, "status": status}]}]}))
            attach_json_results(report, "test-frontend-unit", [output])
        attach("/build/other/example.test.tsx", target["test_id"], "passed")
        self.assertEqual(target["outcome"], "not-run")
        attach("/build/" + target["path"], "renders something else", "passed")
        self.assertEqual(target["outcome"], "not-run")
        for status, expected in [("passed", "passed"), ("failed", "failed"),
                                 ("pending", "skipped"), ("todo", "skipped"), ("unknown", "not-run")]:
            attach("/build/" + target["path"], target["test_id"], status)
            self.assertEqual(target["outcome"], expected)
        output.write_text('{"testResults": []}')
        attach_json_results(report, "test-frontend-unit", [output])
        self.assertEqual(target["outcome"], "not-run")
        self.assertNotIn("evidence", target)

    def test_json_duplicate_identities_are_not_passing_evidence(self):
        target = {"path": "ai-orchestration/ai-orchestration-monitor/tests/example.test.tsx",
                  "test_id": "renders a result", "suite": "test-ai-monitor-component"}
        report = {"cases": {"example": {"tests": [target]}}}
        output = self.root / "vitest.json"
        output.write_text(json.dumps({"testResults": [{"name": "/build/" + target["path"],
            "assertionResults": [{"title": target["test_id"], "status": "passed"}] * 2}]}))
        attach_json_results(report, "test-ai-monitor-component", [output])
        self.assertEqual(target["outcome"], "not-run")

    def test_execution_context_changes_with_application_and_runner_inputs(self):
        source = self.root / "backend/cloudapp/src/main/Example.java"
        source.parent.mkdir(parents=True)
        source.write_text("class Example {}")
        first = context(self.root)
        source.write_text("class Example { int value = 2; }")
        self.assertNotEqual(first, context(self.root))
        first = context(self.root)
        compose = self.root / "docker-compose.test.yml"
        compose.write_text(compose.read_text() + "# runner changed\n")
        self.assertNotEqual(first, context(self.root))
        first = context(self.root)
        cache = self.root / "backend/cloudapp/target/generated.class"
        cache.parent.mkdir(parents=True)
        cache.write_bytes(b"cached output")
        self.assertEqual(first, context(self.root))

    def test_merged_evidence_requires_current_context_and_all_default_targets(self):
        results = self.root / "results"
        folder = results / "requirements"
        (folder / "junit").mkdir(parents=True)
        (folder / "context.json").write_text(json.dumps(context(self.root)))
        xml = folder / "junit/TEST-example.xml"
        xml.write_text('<testsuite><testcase classname="test_example.Example" name="test_exact"/></testsuite>')
        def completed():
            (folder / "run.json").write_text(json.dumps({"exit_code": 0,
                "context_sha256": digest(folder / "context.json"),
                "reports": {"junit/TEST-example.xml": digest(xml)}}))
        completed()
        report = merge(self.root, results)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["execution"], {"passed": 1})
        xml.write_text(xml.read_text() + "\n")
        self.assertTrue(any("report bytes" in error for error in merge(self.root, results)["errors"]))
        xml.write_text('<testsuite><testcase classname="test_example.Example" name="test_exact"><skipped/></testcase></testsuite>')
        completed()
        self.assertTrue(merge(self.root, results)["errors"])
        (folder / "context.json").write_text("{}")
        self.assertTrue(any("context does not match" in error for error in merge(self.root, results)["errors"]))
        (folder / "context.json").unlink()
        self.assertTrue(merge(self.root, results)["errors"])

    def test_native_wrapper_invalidates_stale_reports_and_records_completion(self):
        folder = self.root / "runner"
        (folder / "junit").mkdir(parents=True)
        xml = folder / "junit/TEST-example.xml"
        xml.write_text("stale pass")
        args = [sys.executable, str(SCRIPTS / "run_native.py"), "--root", str(self.root),
                "--results", str(folder), "--result", "junit", "--", sys.executable, "-c"]
        failed = subprocess.run(args + ["raise SystemExit(7)"], capture_output=True)
        self.assertEqual(failed.returncode, 7)
        self.assertFalse(xml.exists())
        self.assertEqual(json.loads((folder / "run.json").read_text())["exit_code"], 7)
        script = f"from pathlib import Path; Path({str(xml)!r}).write_text('<testsuite/>')"
        passed = subprocess.run(args + [script], capture_output=True)
        self.assertEqual(passed.returncode, 0)
        manifest = json.loads((folder / "run.json").read_text())
        self.assertEqual(manifest["exit_code"], 0)
        self.assertEqual(manifest["reports"], {"junit/TEST-example.xml": digest(xml)})
        self.assertEqual(manifest["context_sha256"], digest(folder / "context.json"))

    def test_playwright_output_is_isolated_from_native_evidence(self):
        config = (ROOT / "playwright.config.ts").read_text()
        output = re.search(r'outputDir\s*:\s*["\']([^"\']+)["\']', config)
        junit = re.search(r'outputFile\s*:\s*["\']([^"\']+)["\']', config)
        self.assertIsNotNone(output, "Playwright must explicitly isolate its cleanup directory")
        self.assertIsNotNone(junit, "Browser JUnit must be written to the mounted result directory")
        output_path = Path(output.group(1))
        self.assertEqual(output_path, Path("test-results/playwright"))
        self.assertEqual(Path(junit.group(1)), output_path / "junit.xml")

    def test_ai_framework_dependency_versions_match_application(self):
        def versions(path):
            result = {}
            for line in path.read_text().splitlines():
                if "==" in line and not line.startswith("#"):
                    package, version = line.split("==", 1)
                    result[package.split("[")[0]] = version
            return result

        app = versions(
            ROOT / "ai-orchestration/ai-orchestration-layer/requirements.txt"
        )
        tests = versions(ROOT / "tests/ai-orchestration-layer/requirements.txt")
        for package in ["fastapi", "pydantic", "python-multipart", "httpx", "langchain-core", "langchain-ollama", "langchain-chroma", "chromadb", "langgraph"]:
            self.assertEqual(tests[package], app[package])


if __name__ == "__main__":
    unittest.main()
