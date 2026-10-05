#!/usr/bin/env python3
"""Check canonical requirements, artifact freshness, and exact test declarations."""
from __future__ import annotations
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import sys
import yaml
from model import ROOT, artifacts, freshness_errors, load_requirements
from test_sources import declarations
from record_execution import context

# Explicit runner/source boundaries prevent attaching a test to an unrelated service.
SUITES = {
    "test-requirements": "tests/requirement-cases/",
    "test-ai-orchestration-layer": "tests/ai-orchestration-layer/",
    "test-e2e": "e2e/",
    "test-frontend-unit": "frontend/cloudapp-shell/src/__tests__/",
    "test-ai-monitor-component": "ai-orchestration/ai-orchestration-monitor/tests/",
    "test-backend": "backend/cloudapp/src/test/",
    "test-backend-petstore": "backend/petstore/src/test/",
    "test-backend-vehicles": "backend/vehicles-api/src/test/",
    "test-backend-webproxy": "backend/web-proxy/src/test/",
}


def unique_json(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def validate(root: Path = ROOT) -> tuple[list[str], dict]:
    errors = []
    report = {
        "schema_version": 1,
        "git_sha": os.environ.get("TRACEABILITY_COMMIT", "unknown"),
        "evidence": "exact source declarations; execution only from context-matched JUnit XML",
        "cases": {},
    }
    try:
        requirements = load_requirements(root)
        expected = artifacts(requirements, root)
        errors.extend(
            freshness_errors(root / "tests/requirement-cases/generated", expected)
        )
        mapping = json.loads(
            (root / "requirements/test-map.json").read_text(),
            object_pairs_hook=unique_json,
        )
        if (
            not isinstance(mapping, dict)
            or type(mapping.get("schema_version")) is not int
            or mapping.get("schema_version") != 2
            or mapping.get("generated_cases") != "tests/requirement-cases/generated"
        ):
            raise ValueError(
                "test map requires schema_version=2 and the canonical generated_cases path"
            )
        if set(mapping) != {
            "schema_version",
            "generated_cases",
            "cases",
        } or not isinstance(mapping["cases"], dict):
            raise ValueError("invalid test-map schema")
        compose = yaml.safe_load((root / "docker-compose.test.yml").read_text())
        services = compose["services"]
        all_command = " ".join(services["test-all"]["entrypoint"])
        matrix = all_command.split("SERVICES='", 1)[1].split("'", 1)[0].split()
        cases = {
            case.id: (req, case)
            for req in requirements
            if req.status != "retired"
            for case in req.cases
        }
        mapped = mapping["cases"]
        errors.extend(
            f"{case_id}: no test mapping"
            for case_id in sorted(cases.keys() - mapped.keys())
        )
        errors.extend(
            f"{case_id}: mapping has no canonical acceptance case"
            for case_id in sorted(mapped.keys() - cases.keys())
        )
        cache = {}
        for case_id, entry in sorted(mapped.items()):
            try:
                if not isinstance(entry, dict) or set(entry) != {
                    "case_digest",
                    "coverage",
                    "targets",
                    "gap",
                    "owner",
                }:
                    raise ValueError(
                        "expected case_digest, coverage, targets, gap, owner"
                    )
                if case_id not in cases:
                    continue
                req, case = cases[case_id]
                if entry["case_digest"] != case.digest:
                    raise ValueError(
                        "case revision changed; review coverage and update case_digest"
                    )
                if entry["coverage"] not in {"complete", "partial", "missing"}:
                    raise ValueError("coverage must be complete, partial, or missing")
                if not isinstance(entry["owner"], str) or not entry["owner"].strip():
                    raise ValueError("coverage needs an owner")
                if not isinstance(entry["gap"], str) or (
                    entry["coverage"] != "complete" and not entry["gap"].strip()
                ):
                    raise ValueError("partial/missing coverage needs an explicit gap")
                if entry["coverage"] == "complete" and entry["gap"]:
                    raise ValueError("complete coverage cannot have an outstanding gap")
                if not isinstance(entry["targets"], list):
                    raise ValueError("targets must be a list")
                if bool(entry["targets"]) != (entry["coverage"] != "missing"):
                    raise ValueError(
                        "missing coverage has no targets; complete/partial coverage needs targets"
                    )
                seen = set()
                checked = []
                for target in entry["targets"]:
                    if not isinstance(target, dict) or set(target) != {
                        "path",
                        "test_id",
                        "suite",
                        "execution",
                        "asserts",
                    }:
                        raise ValueError("invalid target schema")
                    if any(
                        not isinstance(value, str) or not value.strip()
                        for value in target.values()
                    ):
                        raise ValueError("target fields must be non-empty strings")
                    path = Path(target["path"])
                    source = root / path
                    if (
                        path.is_absolute()
                        or ".." in path.parts
                        or not source.resolve().is_relative_to(root.resolve())
                        or not source.is_file()
                    ):
                        raise ValueError(f"invalid test source: {path}")
                    suite = target["suite"]
                    if (
                        suite not in SUITES
                        or suite not in services
                        or suite not in matrix
                        or not path.as_posix().startswith(SUITES[suite])
                    ):
                        raise ValueError(
                            f"test source is not in the declared Docker suite: {suite}/{path}"
                        )
                    if target["execution"] not in {"default", "opt-in"}:
                        raise ValueError("execution must be default or opt-in")
                    if (
                        path.name.startswith("nightly-")
                        and target["execution"] != "opt-in"
                    ):
                        raise ValueError("nightly tests must be labeled opt-in")
                    identity = (str(path), target["test_id"], suite)
                    if identity in seen:
                        raise ValueError(f"duplicate test target: {identity}")
                    seen.add(identity)
                    if path not in cache:
                        cache[path] = declarations(source)
                    if target["test_id"] not in cache[path]:
                        raise ValueError(
                            f'exact test declaration not found: {path}::{target["test_id"]}'
                        )
                    checked.append(
                        {**target, "declaration": "found", "outcome": "not-run"}
                    )
                report["cases"][case_id] = {
                    "requirement": req.id,
                    "case_digest": case.digest,
                    "coverage": entry["coverage"],
                    "gap": entry["gap"],
                    "owner": entry["owner"],
                    "tests": checked,
                }
            except (ValueError, SyntaxError, TypeError) as error:
                errors.append(f"{case_id}: {error}")
        if not errors:
            report["context"] = context(root)
        report["coverage"] = dict(
            Counter(case["coverage"] for case in report["cases"].values())
        )
    except (
        OSError,
        ValueError,
        TypeError,
        KeyError,
        IndexError,
        yaml.YAMLError,
    ) as error:
        errors.append(str(error))
    report["errors"] = errors
    return errors, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument(
        "--report",
        type=Path,
        help="write a source-validation JSON report; outcomes remain not-run",
    )
    args = parser.parse_args()
    errors, report = validate(args.root.resolve())
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    if errors:
        print(
            "Requirement traceability validation failed:\n"
            + "\n".join(f"- {error}" for error in errors),
            file=sys.stderr,
        )
        return 1
    print(
        f'Validated {len(report["cases"])} canonical acceptance cases; declared coverage: {report["coverage"]}. Execution: not-run.'
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
