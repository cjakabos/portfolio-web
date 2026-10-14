#!/usr/bin/env python3
"""Validate a coding-agent task record and its declared Git write boundary.

This checks reviewable declarations, not human identity or tool permissions.
It never executes a task's commands or grants access to credentials.
"""
import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
ACTIONS = {"read-repository", "edit-scoped-files", "run-local-checks", "commit-on-task-branch"}
DENIED = {"external-mutations", "publish-or-deploy", "change-repository-settings", "read-unlisted-secrets"}
UNTRUSTED = {"issue-text", "model-output", "web-content", "logs-and-tool-output", "repository-data"}
ESCALATIONS = {"product-ambiguity", "scope-change", "new-credentials", "external-operation", "security-exception", "failed-gate"}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(), object_pairs_hook=unique_object)


def fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ValueError(f"{label}: expected fields {sorted(expected)}")


def strings(value, label, unique=True):
    if not isinstance(value, list) or not value or any(not isinstance(v, str) or not v.strip() for v in value):
        raise ValueError(f"{label}: expected nonempty string list")
    if unique and len(value) != len(set(value)):
        raise ValueError(f"{label}: duplicate entries")


def safe_path(root, value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("paths must be repository-relative")
    path = Path(value)
    if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] == ".git":
        raise ValueError(f"unsafe task path: {value}")
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"task path escapes repository: {value}")
    if resolved.relative_to(root.resolve()).parts[:1] == (".git",):
        raise ValueError(f"task path aliases Git metadata: {value}")
    return path.as_posix().rstrip("/")


def git(root, *args):
    result = subprocess.run(["git", "-c", f"safe.directory={root.resolve()}", "-C", str(root), *args], text=True, capture_output=True)
    if result.returncode:
        raise ValueError("Git comparison unavailable; fetch/restore the recorded base before continuing")
    return result.stdout


def validate(task, root, check_diff=False):
    fields(task, {"schema_version", "id", "objective", "branch", "base_commit", "requirements", "authority", "checks", "escalation", "review"}, "task")
    if type(task["schema_version"]) is not int or task["schema_version"] != 1:
        raise ValueError("unsupported task schema")
    for key in ("id", "objective", "branch"):
        if not isinstance(task[key], str) or not task[key].strip():
            raise ValueError(f"task {key} must be nonempty")
    if not isinstance(task["base_commit"], str) or not re.fullmatch(r"[0-9a-f]{40}", task["base_commit"]):
        raise ValueError("base_commit must be an exact commit SHA")
    authority = task["authority"]
    fields(authority, {"status", "approved_by", "approved_on", "source", "allowed_actions", "denied_actions", "write_paths", "credentials", "network", "untrusted_inputs"}, "authority")
    if authority["status"] != "approved":
        raise ValueError("task requires a recorded human approval; draft tasks cannot authorize work")
    for key in ("approved_by", "approved_on", "source"):
        if not isinstance(authority[key], str) or not authority[key].strip():
            raise ValueError(f"authority {key} must identify the human decision")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", authority["approved_on"]):
        raise ValueError("approved_on must be YYYY-MM-DD")
    date.fromisoformat(authority["approved_on"])
    for key, choices in (("allowed_actions", ACTIONS), ("denied_actions", DENIED), ("untrusted_inputs", UNTRUSTED)):
        strings(authority[key], key)
        actual = set(authority[key])
        if (key == "allowed_actions" and not actual <= choices) or (key != "allowed_actions" and actual != choices):
            raise ValueError(f"unsupported or missing {key}")
    strings(authority["write_paths"], "write_paths")
    scopes = [safe_path(root, value) for value in authority["write_paths"]]
    if any(scope == "." for scope in scopes):
        raise ValueError("whole-repository write scope is not a bounded task")
    fields(authority["credentials"], {"mode", "references"}, "credentials")
    if authority["credentials"]["mode"] not in ("none", "ephemeral-test-only") or authority["credentials"]["references"] != []:
        raise ValueError("this contract permits no live credentials; request a separately reviewed integration task")
    fields(authority["network"], {"dependency_downloads", "live_services"}, "network")
    if type(authority["network"]["dependency_downloads"]) is not bool or authority["network"]["live_services"] != []:
        raise ValueError("live services require a separately reviewed integration task")
    strings(task["escalation"], "escalation")
    if set(task["escalation"]) != ESCALATIONS:
        raise ValueError("missing escalation triggers")
    fields(task["review"], {"independent", "required_before", "criteria"}, "review")
    if task["review"]["independent"] is not True or task["review"]["required_before"] != "promotion":
        raise ValueError("independent review is required before promotion")
    strings(task["review"]["criteria"], "review criteria")
    if not {"scope", "correctness", "security", "execution-evidence"} <= set(task["review"]["criteria"]):
        raise ValueError("missing independent review criteria")
    if not isinstance(task["checks"], list) or not task["checks"]:
        raise ValueError("task must declare reproducible checks")
    for check in task["checks"]:
        fields(check, {"argv", "purpose"}, "check")
        strings(check["argv"], "check argv", unique=False)
        if not isinstance(check["purpose"], str) or not check["purpose"].strip():
            raise ValueError("check must explain its purpose")
    if not isinstance(task["requirements"], list) or not task["requirements"]:
        raise ValueError("task must link accepted requirement intent")
    # Reuse the canonical parser and human-decision validation. Generated status
    # or a digest alone cannot establish that a person accepted the requirement.
    sys.path.insert(0, str(ROOT / "scripts/requirements"))
    try:
        from model import load_requirements
        from intent_baseline import validate_intent
    except ImportError as error:
        raise ValueError("requirement runtime unavailable; use the Docker test-requirements image") from error
    requirements = load_requirements(root)
    errors, intent = validate_intent(root, requirements, required=True)
    if errors:
        raise ValueError("invalid accepted product intent: " + "; ".join(errors))
    baseline = intent["baseline"]["requirements"]
    known = {item.id: item for item in requirements}
    seen = set()
    for requirement in task["requirements"]:
        fields(requirement, {"id", "digest", "scenario_ids"}, "requirement")
        identity = requirement["id"]
        if identity in seen or identity not in baseline or identity not in known:
            raise ValueError("unknown, duplicate, or unaccepted requirement")
        seen.add(identity)
        source = root / "requirements" / f"{identity}.md"
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if known[identity].status != "accepted" or requirement["digest"] != digest or baseline[identity]["digest"] != digest:
            raise ValueError(f"{identity}: task intent differs from accepted revision")
        strings(requirement["scenario_ids"], "scenario_ids")
        if not set(requirement["scenario_ids"]) <= {case.id for case in known[identity].cases}:
            raise ValueError("unknown requirement scenario")
    if check_diff:
        if git(root, "branch", "--show-current").strip() != task["branch"]:
            raise ValueError("current branch differs from task branch")
        base = task["base_commit"]
        git(root, "merge-base", "--is-ancestor", base, "HEAD")
        changed = git(root, "diff", "--name-only", "--no-renames", "-z", base).split("\0")
        changed += git(root, "diff", "--cached", "--name-only", "--no-renames", "-z", base).split("\0")
        changed += git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
        if any(changed) and "edit-scoped-files" not in authority["allowed_actions"]:
            raise ValueError("task does not permit file edits")
        for path in filter(None, changed):
            normalized = safe_path(root, path)
            if not any(normalized == scope or normalized.startswith(scope + "/") for scope in scopes):
                raise ValueError(f"changed file outside approved scope: {path}")
    return task["id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task", type=Path)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--check-diff", action="store_true")
    args = parser.parse_args()
    try:
        identity = validate(read_json(args.task), args.root, args.check_diff)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Task contract rejected: {error}")
        return 1
    print(f"Task contract valid: {identity} (declared human authority; no actions executed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
