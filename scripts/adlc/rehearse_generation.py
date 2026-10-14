#!/usr/bin/env python3
"""Rehearse accepted case generation, failure and recovery without live services."""
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/adlc"))
from task_contract import read_json, validate

TASK = ROOT / "work-items/agent-tasks/LIFECYCLE-GENERATION-2026-10-13.json"
OUTPUT = ROOT / "test-results/adlc-generation/run.json"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rehearse(root=ROOT, task_path=TASK, output=OUTPUT):
    root, task_path, output = Path(root), Path(task_path), Path(output)
    resolved = output.resolve()
    if not (resolved.is_relative_to((root / "test-results/adlc-generation").resolve())
            or resolved.is_relative_to(Path(tempfile.gettempdir()).resolve()) and not resolved.is_relative_to(root.resolve())):
        raise ValueError("rehearsal output must be in its test-results directory or a temporary directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"schema_version": 1, "status": "running", "recorded_at": datetime.now(timezone.utc).isoformat(),
              "task": "LIFECYCLE-GENERATION-2026-10-13", "case": "AC-REQ-HARNESS-001-04", "steps": [],
              "release_scope": "local rehearsal only", "temporary_workspace_removed": False}
    workspace = None
    # Invalidate previous success even if intent validation or generation fails.
    output.write_text(json.dumps(report, indent=2)+"\n")
    try:
        task = read_json(task_path)
        validate(task, root)
        if task["id"] != report["task"] or task["requirements"][0]["scenario_ids"] != [report["case"]]:
            raise ValueError("replay must use the bounded generation task")
        report["task_digest"] = digest(task_path)
        report["runtime"] = {"python": sys.version.split()[0], "PyYAML": version("PyYAML"), "gherkin-official": version("gherkin-official")}
        inputs = [*sorted((root / "requirements").glob("REQ-*.md")),
                  *sorted((root / "requirements/reviews").glob("*.md")), root / "requirements/baseline.json",
                  root / "scripts/requirements/generate_cases.py", root / "scripts/requirements/model.py",
                  root / "scripts/requirements/intent_baseline.py", root / "scripts/requirements/requirements.txt",
                  root / "scripts/requirements/Dockerfile", root / "scripts/adlc/task_contract.py",
                  root / "scripts/adlc/rehearse_generation.py", root / "AGENTS.md",
                  root / "docs/platform/coding-agent-authority.md"]
        before = {str(path.relative_to(root)): digest(path) for path in inputs}
        report["inputs"] = before
        report["accepted_requirement_digest"] = task["requirements"][0]["digest"]
        with tempfile.TemporaryDirectory(prefix="adlc-generation-") as directory:
            workspace = Path(directory)
            shutil.copytree(root / "requirements", workspace / "requirements")
            generator = root / "scripts/requirements/generate_cases.py"
            def run(label, check=False, expected=0):
                argv = [sys.executable, str(generator), "--root", str(workspace)]
                if check:
                    argv.append("--check")
                result = subprocess.run(argv, text=True, capture_output=True)
                report["steps"].append({"name": label, "argv_template": ["python3", "scripts/requirements/generate_cases.py", "--root", "<temporary-workspace>", *(["--check"] if check else [])],
                                        "expected_exit_code": expected, "exit_code": result.returncode,
                                        "stdout": result.stdout, "stderr": result.stderr})
                if result.returncode != expected:
                    raise RuntimeError(f"{label}: expected exit {expected}, received {result.returncode}")
            run("generate accepted cases")
            run("verify initial freshness", check=True)
            generated = workspace / "tests/requirement-cases/generated"
            original = {path.name: digest(path) for path in generated.iterdir()}
            feature = generated / "REQ-HARNESS-001.feature"
            text = feature.read_text()
            if report["case"] not in text or "requirements/REQ-HARNESS-001.md" not in text:
                raise RuntimeError("generated case lost its accepted ID or source link")
            feature.unlink()  # Fault injection only in a disposable workspace.
            run("reject missing generated feature", check=True, expected=2)
            run("recover by regeneration")
            run("verify recovered freshness", check=True)
            recovered = {path.name: digest(path) for path in generated.iterdir()}
            if recovered != original:
                raise RuntimeError("recovery differs from original accepted output")
            report["generated_artifacts"] = recovered
            report["rollback_equivalence"] = True
        report["temporary_workspace_removed"] = not workspace.exists()
        if before != {str(path.relative_to(root)): digest(path) for path in inputs}:
            raise RuntimeError("canonical replay inputs changed during execution")
        report["canonical_inputs_unchanged"] = True
        report["status"] = "passed"
        return report
    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)
        raise
    finally:
        if workspace is not None:
            report["temporary_workspace_removed"] = not workspace.exists()
        report["completed_at"] = datetime.now(timezone.utc).isoformat()
        output.write_text(json.dumps(report, indent=2)+"\n")


def main():
    try:
        rehearse()
    except (OSError, ValueError, RuntimeError) as error:
        print(f"ADLC rehearsal failed: {error}")
        return 1
    print(f"ADLC generation rehearsal passed; evidence: {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
