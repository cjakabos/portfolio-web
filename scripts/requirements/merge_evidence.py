#!/usr/bin/env python3
"""Validate the checkout and merge its context-bound native runner evidence."""
import argparse
from collections import Counter
import json
from pathlib import Path
from model import ROOT
from report_results import attach_results, attach_json_results
from validate_traceability import validate
from record_execution import digest
from intent_baseline import promotion_errors

RUNNERS = {
    "test-requirements": ("requirements", "junit", "xml"),
    "test-backend": ("backend/cloudapp", "junit", "xml"),
    "test-backend-petstore": ("backend/petstore", "junit", "xml"),
    "test-backend-vehicles": ("backend/vehicles-api", "junit", "xml"),
    "test-backend-webproxy": ("backend/web-proxy", "junit", "xml"),
    "test-ml-pipeline": ("ml-pipeline", "ml-pipeline.xml", "xml"),
    "test-ai-orchestration-layer": ("ai-orchestration", "ai-orchestration.xml", "xml"),
    "test-frontend-unit": ("frontend-unit", "jest.json", "json"),
    "test-ai-monitor-component": ("ai-monitor-component", "vitest.json", "json"),
}


def merge(root, results, required_requirements=()):
    errors, report = validate(root, require_accepted_baseline=True)
    if errors:
        return report
    errors.extend(promotion_errors(report["intent"], required_requirements))
    suites = {target["suite"] for case in report["cases"].values()
              for target in case["tests"] if target["execution"] == "default"}
    for suite in sorted(suites):
        try:
            directory, filename, format = RUNNERS[suite]
            folder = results / directory
            completed = json.loads((folder / "run.json").read_text())
            if completed.get("exit_code") != 0:
                raise ValueError("native runner did not complete successfully")
            if json.loads((folder / "context.json").read_text()) != report["context"]:
                raise ValueError("runner context does not match the validated revision")
            output = folder / filename
            paths = sorted(output.glob("*.xml")) if output.is_dir() else [output]
            if not paths:
                raise ValueError("no runner reports found")
            if completed.get("context_sha256") != digest(folder / "context.json") or completed.get("reports") != {
                    str(path.relative_to(folder)): digest(path) for path in paths}:
                raise ValueError("report bytes or context differ from the completed native run")
            adapter = attach_results if format == "xml" else attach_json_results
            adapter(report, suite, paths)
        except (OSError, ValueError, KeyError, SyntaxError) as error:
            errors.append(f"{suite}: {error}")
    for case_id, case in report["cases"].items():
        targets = [target for target in case["tests"] if target["execution"] == "default"]
        outcomes = [target["outcome"] for target in targets]
        case["execution"] = ("failed" if "failed" in outcomes else
            "skipped" if "skipped" in outcomes else
            "passed" if targets and all(value == "passed" for value in outcomes) else "not-run")
        if case["coverage"] != "complete" or case["execution"] != "passed":
            errors.append(f"{case_id}: coverage={case['coverage']}, execution={case['execution']}")
    report["execution"] = dict(Counter(case["execution"] for case in report["cases"].values()))
    report["execution_by_intent"] = {
        status: dict(Counter(case["execution"] for case in report["cases"].values()
                            if case["requirement_status"] == status))
        for status in ("accepted", "proposed")
    }
    report["errors"] = errors
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--results", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--requirement-id", action="append", default=[],
        help="require accepted intent for each selected promotion requirement (repeatable)",
    )
    args = parser.parse_args()
    results = args.results or args.root / "test-results"
    output = args.output or results / "requirements/executed-traceability.json"
    report = merge(args.root, results, args.requirement_id)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"intent": report.get("intent", {}).get("counts"), "coverage": report.get("coverage"), "execution": report.get("execution"), "execution_by_intent": report.get("execution_by_intent"), "errors": report["errors"]}, indent=2))
    return bool(report["errors"])


if __name__ == "__main__":
    raise SystemExit(main())
