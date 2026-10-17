"""Exercise backend-build recovery using disposable Maven command failures."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
TRANSFER = "[ERROR] Could not transfer artifact example:fixture:jar:1 from/to central: "


class MavenBuildRecoveryTests(unittest.TestCase):
    def run_build(self, outcomes):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = root / "calls.jsonl"
            pauses = root / "pauses.txt"
            maven = root / "mvn"
            maven.write_text(f"#!{sys.executable}\n" + '''
import json, os, pathlib, sys
calls = pathlib.Path(os.environ["MAVEN_FIXTURE_CALLS"])
attempt = len(calls.read_text().splitlines()) if calls.exists() else 0
with calls.open("a") as stream:
    stream.write(json.dumps(sys.argv[1:]) + "\\n")
outcomes = json.loads(os.environ["MAVEN_FIXTURE_OUTCOMES"])
status, output = outcomes[min(attempt, len(outcomes) - 1)]
print(output)
sys.exit(status)
''')
            maven.chmod(0o755)
            sleep = root / "sleep"
            sleep.write_text('#!/bin/sh\nprintf "%s\\n" "$1" >> "$MAVEN_FIXTURE_PAUSES"\n')
            sleep.chmod(0o755)
            result = subprocess.run(
                ["sh", str(ROOT / "scripts/maven-build.sh"), "-DskipTests", "package"],
                cwd=root, text=True, capture_output=True, timeout=10,
                env={**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"],
                     "MAVEN_FIXTURE_CALLS": str(calls),
                     "MAVEN_FIXTURE_PAUSES": str(pauses),
                     "MAVEN_FIXTURE_OUTCOMES": json.dumps(outcomes)},
            )
            attempts = [json.loads(line) for line in calls.read_text().splitlines()]
            delays = pauses.read_text().splitlines() if pauses.exists() else []
            return result, attempts, delays

    def test_success_preserves_maven_arguments_without_retry(self):
        result, calls, delays = self.run_build([(0, "BUILD SUCCESS")])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][-2:], ["-DskipTests", "package"])
        self.assertIn("--update-snapshots", calls[0])
        self.assertEqual(delays, [])

    def test_connection_reset_recovers_and_retains_failure_output(self):
        result, calls, delays = self.run_build([
            (1, TRANSFER + "Connection reset"), (0, "BUILD SUCCESS")])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0], calls[1])
        self.assertEqual(delays, ["5"])
        self.assertIn("Connection reset", result.stdout)
        self.assertIn("BUILD SUCCESS", result.stdout)

    def test_persistent_transfer_failure_stops_after_three_attempts(self):
        result, calls, delays = self.run_build([(17, TRANSFER + "Connection reset")])
        self.assertEqual(result.returncode, 17)
        self.assertEqual(len(calls), 3)
        self.assertEqual(delays, ["5", "10"])

    def test_timeouts_and_temporary_http_failures_can_recover(self):
        for failure in ["Read timed out", "status code: 429", "status code: 502",
                        "status code: 503", "status code: 504"]:
            with self.subTest(failure=failure):
                result, calls, _ = self.run_build([(1, TRANSFER + failure), (0, "BUILD SUCCESS")])
                self.assertEqual(result.returncode, 0)
                self.assertEqual(len(calls), 2)

    def test_permanent_transfer_errors_are_not_retried(self):
        for failure in ["status code: 401", "status code: 403", "status code: 404",
                        "PKIX path building failed"]:
            with self.subTest(failure=failure):
                result, calls, delays = self.run_build([(19, TRANSFER + failure)])
                self.assertEqual(result.returncode, 19)
                self.assertEqual(len(calls), 1)
                self.assertEqual(delays, [])

    def test_compilation_failure_does_not_retry_unrelated_network_output(self):
        result, calls, delays = self.run_build([
            (23, "[WARNING] Connection reset\n[ERROR] COMPILATION ERROR: cannot find symbol")])
        self.assertEqual(result.returncode, 23)
        self.assertEqual(len(calls), 1)
        self.assertEqual(delays, [])

    def test_compilation_failure_after_transfer_recovery_stops_immediately(self):
        result, calls, delays = self.run_build([
            (1, TRANSFER + "Connection reset"),
            (23, "[ERROR] COMPILATION ERROR: cannot find symbol"), (0, "BUILD SUCCESS")])
        self.assertEqual(result.returncode, 23)
        self.assertEqual(len(calls), 2)
        self.assertEqual(delays, ["5"])
