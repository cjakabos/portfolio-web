#!/usr/bin/env python3
"""Import a fixture or read-only Jira issue as a traceable Markdown proposal."""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from model import ROOT, REQ_ID, parse_requirement, parse_feature
from jira_sources import ISSUE_KEY, load_fixture, load_jira


ISSUE_KEY_PATTERN = ISSUE_KEY


def scenario_tags(body: str, requirement_id: str) -> list[tuple[str, str]]:
    _, cases = parse_feature(body, requirement_id, "snapshot")
    return [(case.id, case.name) for case in cases]


def load_requirement(
    requirement_id: str, root: Path = ROOT
) -> tuple[Path, dict[str, Any], str]:
    if not isinstance(requirement_id, str) or not REQ_ID.fullmatch(requirement_id):
        raise ValueError(f"invalid requirement ID: {requirement_id}")
    path = root / "requirements" / f"{requirement_id}.md"
    if not path.is_file():
        raise ValueError(f"unknown requirement ID: {requirement_id}")
    requirement = parse_requirement(path)
    if requirement.status == "retired":
        raise ValueError(f"requirement is retired: {requirement_id}")
    return path, requirement.metadata, requirement.body


def markdown_text(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").strip()


def table_value(value: Any) -> str:
    return markdown_text(value).replace("|", "&#124;").replace("\n", "<br>")


def render_work_item(
    issue: dict[str, Any],
    fingerprint: str,
    requirements: list[tuple[str, Path, dict[str, str], str]],
    root: Path = ROOT,
    output_dir: Path | None = None,
) -> str:
    issue_key = markdown_text(issue["key"])
    output_dir = output_dir or root / "work-items"
    notice = (["> Synthetic fixture intake. No Jira connection was made and no Jira",
               "> operation was performed."] if issue["source"] == "synthetic-fixture" else
              ["> Read-only Jira snapshot. The source was read using GET; no Jira",
               "> create, update, transition, or delete operation was performed.",
               "> Imported issue content is source data for human review."])
    lines = [
        f"# {issue_key} — {markdown_text(issue['summary'])}",
        "",
        *notice,
        "",
        "## Source snapshot",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Source | {table_value(issue.get('source'))} |",
        f"| Issue | [{issue_key}]({markdown_text(issue['url'])}) |",
        f"| Type / status / priority | {table_value(issue.get('issue_type'))} / {table_value(issue.get('status'))} / {table_value(issue.get('priority'))} |",
        f"| Created / updated | {table_value(issue.get('created_at'))} / {table_value(issue.get('updated_at'))} |",
        f"| Snapshot SHA-256 | {fingerprint} |",
        *([f"| Retrieved at | {table_value(issue['retrieved_at'])} |"] if issue.get("retrieved_at") else []),
        *([f"| Requested issue | {table_value(issue['requested_key'])} |"] if issue.get("requested_key") else []),
        *([f"| Requirement link source | {table_value(issue['requirement_link_source'])} |"] if issue.get("requirement_link_source") else []),
        "",
        "## Change request",
        "",
        markdown_text(issue.get("description")),
        "",
        "## Requirement links",
        "",
    ]
    for requirement_id, path, metadata, body in requirements:
        relative_path = path.relative_to(root).as_posix()
        title = metadata.get("title", requirement_id)
        link = Path(os.path.relpath(root / relative_path, output_dir)).as_posix()
        lines.append(f"- [{requirement_id} — {title}]({link})")
        lines.append(
            f"  Baseline SHA-256: {hashlib.sha256(path.read_bytes()).hexdigest()}"
        )
        scenarios = scenario_tags(body, requirement_id)
        if scenarios:
            lines.extend(
                [
                    "",
                    "  Linked acceptance scenarios:",
                    *[f"  - {case_id} — {name}" for case_id, name in scenarios],
                ]
            )
    lines.extend(
        [
            "",
            "## Proposed requirement amendment",
            "",
            "> Proposal only. The canonical requirement has not been changed.",
            "",
            markdown_text(issue.get("proposed_requirement_change"))
            or "No requirement delta was supplied.",
            "",
            "## Traceability",
            "",
            "| Jira issue | Requirement | Acceptance scenarios | Generated case |",
            "| --- | --- | --- | --- |",
        ]
    )
    for requirement_id, _, _, body in requirements:
        cases = scenario_tags(body, requirement_id)
        case_list = ", ".join(case_id for case_id, _ in cases) or "None defined"
        generated = (
            f"tests/requirement-cases/generated/{requirement_id}.feature"
            if cases
            else "Not generated"
        )
        lines.append(f"| {issue_key} | {requirement_id} | {case_list} | {generated} |")
    lines.extend(
        [
            "",
            "## Human review",
            "",
            "- Confirm the linked requirement IDs and proposed delta.",
            "- Resolve product or technical questions before implementation.",
            "- Update the canonical requirement in a reviewed PR; regenerate its",
            "  acceptance cases in the same change.",
            "- Add the implementation PR link to this trace when available.",
            "- Update Jira only through a separate, explicitly approved action.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue", required=True, help="existing issue key, such as PROJECT-123")
    parser.add_argument("--source", choices=["fixture", "jira"], default="fixture",
                        help="fixture by default; Jira uses dedicated JIRA_INTAKE_* settings")
    parser.add_argument("--requirement-id", action="append", dest="requirements",
                        help="explicit requirement link; repeat for multiple IDs; overrides source links")
    parser.add_argument("--proposed-change", help="human-authored requirement amendment proposal")
    parser.add_argument("--force", action="store_true", help="replace an existing work-item snapshot after review")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository containing fixtures and requirements")
    parser.add_argument("--output-dir", type=Path, default=Path("work-items"),
                        help="snapshot directory; relative paths resolve under the repository")
    args = parser.parse_args()
    root = args.root.resolve()
    output_dir = (args.output_dir if args.output_dir.is_absolute() else root / args.output_dir).resolve()
    issue_key = args.issue.strip().upper()
    if not ISSUE_KEY_PATTERN.fullmatch(issue_key):
        parser.error("issue key must use PROJECT-123 format")

    def protect_existing(key):
        path = output_dir / f"{key}.md"
        if path.exists() and not args.force:
            raise ValueError(f"Refusing to overwrite {key}.md; use --force after reviewing.")
        return path

    try:
        # Invalid local links and existing human edits are rejected before any GET.
        protect_existing(issue_key)
        if args.requirements:
            if len(args.requirements) != len(set(args.requirements)):
                raise ValueError("issue contains duplicate requirement IDs")
            for identity in args.requirements:
                load_requirement(identity, root)
        snapshot = load_fixture(root, issue_key) if args.source == "fixture" else load_jira(issue_key)
        issue = dict(snapshot.issue)
        if not isinstance(issue.get("summary"), str) or not issue["summary"].strip():
            raise ValueError("Issue must be an object with a non-empty summary.")
        if args.requirements:
            issue["requirement_ids"] = args.requirements
            issue["requirement_link_source"] = "Explicit --requirement-id arguments"
        if args.proposed_change is not None:
            issue["proposed_requirement_change"] = args.proposed_change
        requirement_ids = issue.get("requirement_ids", [])
        if not isinstance(requirement_ids, list) or not requirement_ids:
            raise ValueError("issue has no linked requirement IDs; use --requirement-id, "
                             "REQ-* Jira labels, or JIRA_INTAKE_REQUIREMENTS_FIELD")
        if any(not isinstance(identity, str) for identity in requirement_ids):
            raise ValueError("requirement IDs must be strings")
        if len(requirement_ids) != len(set(requirement_ids)):
            raise ValueError("issue contains duplicate requirement IDs")
        linked_requirements = []
        for identity in requirement_ids:
            path, metadata, body = load_requirement(identity, root)
            linked_requirements.append((identity, path, metadata, body))
        # Jira resolves moved issue keys; use and protect its canonical key too.
        output_path = protect_existing(issue["key"])
        rendered = render_work_item(issue, snapshot.fingerprint, linked_requirements, root, output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        # Finish the snapshot before publishing it. Hard-link creation is
        # exclusive, so a concurrent importer/editor cannot be overwritten.
        descriptor, temporary = tempfile.mkstemp(prefix=f".{issue['key']}.", suffix=".tmp", dir=output_dir)
        temporary_path = Path(temporary)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                output.write(rendered)
                output.flush()
                os.fsync(output.fileno())
            if args.force:
                os.replace(temporary_path, output_path)
            else:
                os.link(temporary_path, output_path)
        finally:
            temporary_path.unlink(missing_ok=True)
    except (OSError, ValueError, TypeError, RecursionError) as error:
        print(f"Cannot import {issue_key}: {error}", file=sys.stderr)
        return 2
    display = output_path.relative_to(root) if output_path.is_relative_to(root) else output_path
    print(f"Wrote {display}")
    if args.source == "fixture":
        print("Source: synthetic fixture; network and Jira write operations: none")
    else:
        print("Source: Jira GET; Jira write operations: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
