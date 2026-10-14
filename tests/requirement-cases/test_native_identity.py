"""Native results cannot borrow identities from another package or module."""
import tempfile
from pathlib import Path
import unittest

from report_results import attach_results
from test_sources import runner_identity


class NativeIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.xml = self.root / "report.xml"

    def report(self, identity, path="backend/cloudapp/src/test/java/intended/ExampleTest.java"):
        target = {"path": path, "test_id": "ExampleTest.testExact", "suite": "test-backend", "runner_id": identity}
        return {"cases": {"case": {"tests": [target]}}}, target

    def attach(self, report, tests):
        self.xml.write_text("<testsuite>" + tests + "</testsuite>")
        attach_results(report, "test-backend", [self.xml])

    def test_wrong_java_package_is_not_passing(self):
        report, target = self.report("intended.ExampleTest.testExact")
        self.attach(report, '<testcase classname="other.ExampleTest" name="testExact"/>')
        self.assertEqual(target["outcome"], "not-run")

    def test_exact_duplicate_is_ambiguous_and_parameters_are_distinct(self):
        report, target = self.report("intended.ExampleTest.testExact")
        item = '<testcase classname="intended.ExampleTest" name="testExact"/>'
        self.attach(report, item * 2)
        self.assertEqual(target["outcome"], "not-run")
        self.attach(report, ''.join(f'<testcase classname="intended.ExampleTest" name="testExact(String)[{i}]"/>' for i in (1, 2)))
        self.assertEqual(target["outcome"], "passed")
        self.attach(report, '<testcase classname="intended.ExampleTest" name="testExact(String)[1]"><skipped/></testcase>')
        self.assertEqual(target["outcome"], "skipped")

    def test_source_resolves_java_package_and_nested_python_module(self):
        source = self.root / "backend/cloudapp/src/test/java/intended/ExampleTest.java"
        source.parent.mkdir(parents=True)
        source.write_text('package intended; class ExampleTest { @Test void testExact() {} }')
        self.assertEqual(runner_identity(str(source.relative_to(self.root)), "ExampleTest.testExact", "test-backend", self.root), "intended.ExampleTest.testExact")
        path = "tests/ai-orchestration-layer/nested/test_example.py"
        identity = runner_identity(path, "test_exact", "test-ai-orchestration-layer", self.root)
        self.assertEqual(identity, "nested.test_example.test_exact")
        report, target = self.report(identity, path)
        self.attach(report, '<testcase classname="other.test_example" name="test_exact"/>')
        self.assertEqual(target["outcome"], "not-run")
