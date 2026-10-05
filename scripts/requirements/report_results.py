#!/usr/bin/env python3
"""Attach exact Python/JUnit XML outcomes to a validated source report.

Results must come from the same checkout as the source report. Browser runner
adapters are not implemented; their outcomes remain not-run.
"""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


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
            source = Path(target["path"])
            identity = target["test_id"]
            matches = []
            for classname, name, outcome in records:
                if source.suffix == ".py":
                    module = source.stem
                    class_parts = classname.split(".")
                    if "." in identity:
                        found = (
                            module in class_parts
                            and f"{class_parts[-1]}.{name}" == identity
                        )
                    else:
                        found = class_parts[-1] == module and name == identity
                elif source.suffix == ".java":
                    found = (
                        f'{classname.split(".")[-1]}.{name}' == identity
                        and classname.split(".")[-1] == source.stem
                    )
                else:
                    found = False
                if found:
                    matches.append(outcome)
            if matches:
                target["outcome"] = (
                    "failed"
                    if "failed" in matches
                    else "skipped" if "skipped" in matches else "passed"
                )
                target["evidence"] = [str(path) for path in xml_paths]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--suite", required=True)
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument(
        "--context",
        type=Path,
        required=True,
        help="checkout context recorded immediately before this runner",
    )
    args = parser.parse_args()
    paths = sorted(args.junit.glob("*.xml")) if args.junit.is_dir() else [args.junit]
    if not paths:
        parser.error("no JUnit XML reports found")
    report = json.loads(args.report.read_text())
    if report.get("errors"):
        parser.error("cannot attach evidence to a failed source validation")
    if json.loads(args.context.read_text()) != report.get("context"):
        parser.error(
            "runner context does not match the validated requirement/test revision"
        )
    report = attach_results(report, args.suite, paths)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
