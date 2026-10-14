"""Exercise the actual Test Summary shell gate with synthetic CI job results."""

from pathlib import Path
import re
import subprocess
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]


class CISummaryGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        workflow = yaml.safe_load((ROOT / ".github/workflows/ci-tests.yml").read_text())
        cls.jobs = workflow["jobs"]
        cls.summary = cls.jobs["test-summary"]
        cls.core_jobs = {
            job_id
            for job_id, job in cls.jobs.items()
            if job.get("name", "").startswith("Core Showcase")
        }
        cls.gate = next(
            step for step in cls.summary["steps"]
            if step.get("name", "").startswith("Enforce ")
        )

    def run_gate(self, results):
        environment = {}
        for variable, expression in self.gate["env"].items():
            match = re.fullmatch(r"\$\{\{\s*needs\.([\w-]+)\.result\s*\}\}", expression)
            self.assertIsNotNone(match, f"Unexpected job result binding: {expression}")
            environment[variable] = results.get(match.group(1), "")
        return subprocess.run(
            ["sh", "-eu", "-c", self.gate["run"]],
            env=environment,
            capture_output=True,
            text=True,
        )

    def successful_results(self):
        return {job_id: "success" for job_id in self.summary["needs"]}

    def test_gate_is_always_run_and_binds_every_core_job(self):
        self.assertEqual(self.summary["if"], "always()")
        self.assertEqual(self.gate["if"], "always()")
        bindings = {
            re.fullmatch(r"\$\{\{\s*needs\.([\w-]+)\.result\s*\}\}", value).group(1)
            for value in self.gate["env"].values()
        }
        self.assertEqual(bindings, self.core_jobs)
        self.assertTrue(self.core_jobs.issubset(self.summary["needs"]))
        self.assertIn("requirements-tests", bindings)
        self.assertIn("requirement-execution-evidence", bindings)
        self.assertIn("e2e-core-tests", bindings)

    def test_gate_rejects_failed_gateway_when_requirements_pass(self):
        results = self.successful_results()
        results["nginx-gateway-tests"] = "failure"
        result = self.run_gate(results)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("nginx-gateway-tests=failure", result.stdout)

    def test_every_core_job_requires_success(self):
        for job_id in sorted(self.core_jobs):
            for status in ("failure", "cancelled", "skipped", "", "unknown"):
                with self.subTest(job=job_id, status=status):
                    results = self.successful_results()
                    results[job_id] = status
                    result = self.run_gate(results)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(f"{job_id}={status}", result.stdout)

    def test_missing_core_result_fails(self):
        results = self.successful_results()
        del results["e2e-core-tests"]
        self.assertNotEqual(self.run_gate(results).returncode, 0)

    def test_all_core_success_allows_informational_failures(self):
        results = {
            job_id: "success" if job_id in self.core_jobs else "failure"
            for job_id in self.summary["needs"]
        }
        result = self.run_gate(results)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_gate_reports_all_unsuccessful_core_jobs(self):
        results = self.successful_results()
        results["api-contract-tests"] = "failure"
        results["frontend-static-checks"] = "cancelled"
        result = self.run_gate(results)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("api-contract-tests=failure", result.stdout)
        self.assertIn("frontend-static-checks=cancelled", result.stdout)


if __name__ == "__main__":
    unittest.main()
