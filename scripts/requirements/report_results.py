#!/usr/bin/env python3
"""Attach exact JUnit XML or Jest/Vitest JSON outcomes to a source report."""
import argparse
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET
from test_sources import runner_identity

ROOT = Path(__file__).resolve().parents[2]


def attach_results(report: dict, suite: str, xml_paths: list[Path]) -> dict:
    # Replace outcomes for this suite so a missing test never inherits a prior pass.
    for case in report["cases"].values():
        for target in case["tests"]:
            if target["suite"] == suite:
                target["outcome"] = "not-run"
                target.pop("evidence", None)
    records = []
    for path in xml_paths:
        for item in ET.parse(path).iter("testcase"):
            outcome = (
                "failed"
                if item.find("failure") is not None or item.find("error") is not None
                else "skipped" if item.find("skipped") is not None else "passed"
            )
            records.append((item.get("classname", ""), item.get("name", ""), outcome))
    for case in report["cases"].values():
        for target in case["tests"]:
            if target["suite"] != suite:
                continue
            expected = target.get("runner_id") or runner_identity(
                target["path"], target["test_id"], suite, ROOT)
            matches = []
            identities = []
            for classname, name, outcome in records:
                native = classname.replace("$", ".") + "." + name
                # Distinct parameter invocations can aggregate; repeated exact
                # identities are ambiguous and never supply passing evidence.
                found = native == expected or bool(expected and re.fullmatch(
                    re.escape(expected) + r"(?:\([^)]*\))?\[[^\]]+\]", native))
                if found:
                    matches.append(outcome)
                    identities.append(native)
            if matches:
                target["outcome"] = (
                    "failed" if "failed" in matches else
                    "skipped" if "skipped" in matches else
                    "passed" if len(identities) == len(set(identities)) else "not-run"
                )
                target["evidence"] = [str(path) for path in xml_paths]
    return report


def attach_json_results(report: dict, suite: str, paths: list[Path]) -> dict:
    """Match file and leaf title; an identically named test elsewhere cannot pass."""
    records = []
    for path in paths:
        data = json.loads(path.read_text())
        for file in data.get("testResults", []):
            name = file.get("name", "").replace("\\", "/")
            for assertion in file.get("assertionResults", []):
                records.append((name, assertion.get("title", ""), assertion.get("status")))
    for case in report["cases"].values():
        for target in case["tests"]:
            if target["suite"] != suite:
                continue
            target["outcome"] = "not-run"
            target.pop("evidence", None)
            source = target["path"]
            matches = [status for name, title, status in records
                       if (name == source or name.endswith("/" + source))
                       and title == target["test_id"]]
            if matches:
                # Duplicate identities are ambiguous; unknown and skipped states
                # never inherit a pass from another result file.
                target["outcome"] = ("failed" if "failed" in matches else
                    "passed" if len(matches) == 1 and matches[0] == "passed" else
                    "skipped" if len(matches) == 1 and matches[0] in {"pending", "skipped", "todo", "disabled"} else "not-run")
                target["evidence"] = [str(path) for path in paths]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--suite", required=True)
    formats = parser.add_mutually_exclusive_group(required=True)
    formats.add_argument("--junit", type=Path)
    formats.add_argument("--json-results", type=Path)
    parser.add_argument(
        "--context",
        type=Path,
        required=True,
        help="checkout context recorded immediately before this runner",
    )
    args = parser.parse_args()
    result = args.junit or args.json_results
    suffix = "*.xml" if args.junit else "*.json"
    paths = sorted(result.glob(suffix)) if result.is_dir() else [result]
    if not paths:
        parser.error("no test reports found")
    report = json.loads(args.report.read_text())
    if report.get("errors"):
        parser.error("cannot attach evidence to a failed source validation")
    if json.loads(args.context.read_text()) != report.get("context"):
        parser.error(
            "runner context does not match the validated requirement/test revision"
        )
    adapter = attach_results if args.junit else attach_json_results
    report = adapter(report, args.suite, paths)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
