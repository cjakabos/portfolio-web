#!/usr/bin/env python3
"""Read a Jira-shaped fixture and create a traceable Markdown work item.

This prototype is deliberately fixture-only: it performs no network requests
and has no Jira write operations. A future read-only adapter can produce the
same normalized issue shape.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REQUIREMENTS_DIR = ROOT / "requirements"
FIXTURES_DIR = ROOT / "fixtures" / "jira"
WORK_ITEMS_DIR = ROOT / "work-items"
ISSUE_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9]+-\d+$")


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        raise ValueError("requirement is missing YAML front matter")
    parts = text.split("---", 2)
    if len(parts) != 3:
        raise ValueError("requirement has an unterminated YAML front matter block")
    metadata: dict[str, str] = {}
    for line in parts[1].splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        if not separator:
            raise ValueError(f"unsupported front matter line: {line}")
        metadata[key.strip()] = value.strip().strip("\"'")
    return metadata, parts[2]


def gherkin_blocks(body: str) -> list[str]:
    fence = chr(96) * 3
    pattern = rf"(?ms)^{fence}gherkin\s*\n(.*?)^{fence}\s*$"
    return re.findall(pattern, body)


def scenario_tags(body: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for block in gherkin_blocks(body):
        pending_tags: list[str] = []
        for line in block.splitlines():
            stripped = line.strip()
            if stripped.startswith("@"):
                pending_tags.extend(re.findall(r"@[A-Za-z0-9_-]+", stripped))
            elif re.match(r"Scenario(?: Outline)?:", stripped):
                scenario_match = re.match(r"Scenario(?: Outline)?:\s*(.*)", stripped)
                case_tag = next(
                    (tag[1:] for tag in pending_tags if tag.startswith("@AC-")),
                    "",
                )
                if case_tag:
                    found.append((case_tag, scenario_match.group(1) if scenario_match else ""))
                pending_tags = []
            elif stripped and not stripped.startswith("#"):
                pending_tags = []
    return found


def load_requirement(requirement_id: str) -> tuple[Path, dict[str, str], str]:
    if not re.fullmatch(r"REQ-[A-Z0-9]+-\d+", requirement_id):
        raise ValueError(f"invalid requirement ID: {requirement_id}")
    path = REQUIREMENTS_DIR / f"{requirement_id}.md"
    if not path.is_file():
        raise ValueError(f"unknown requirement ID: {requirement_id}")
    text = path.read_text(encoding="utf-8")
    metadata, body = parse_front_matter(text)
    if metadata.get("id") != requirement_id:
        raise ValueError(f"requirement ID does not match front matter in {path.name}")
    if metadata.get("status") == "retired":
        raise ValueError(f"requirement is retired: {requirement_id}")
    return path, metadata, body


def markdown_text(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").strip()


def table_value(value: Any) -> str:
    return markdown_text(value).replace("|", "&#124;").replace("\n", "<br>")


def render_work_item(
    issue: dict[str, Any],
    fingerprint: str,
    requirements: list[tuple[str, Path, dict[str, str], str]],
) -> str:
    issue_key = markdown_text(issue["key"])
    lines = [
        f"# {issue_key} — {markdown_text(issue['summary'])}",
        "",
        "> Synthetic fixture intake. No Jira connection was made and no Jira",
        "> operation was performed.",
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
        "",
        "## Change request",
        "",
        markdown_text(issue.get("description")),
        "",
        "## Requirement links",
        "",
    ]
    for requirement_id, path, metadata, body in requirements:
        relative_path = path.relative_to(ROOT).as_posix()
        title = metadata.get("title", requirement_id)
        lines.append(f"- [{requirement_id} — {title}](../{relative_path})")
        scenarios = scenario_tags(body)
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
        cases = scenario_tags(body)
        case_list = ", ".join(case_id for case_id, _ in cases) or "None defined"
        generated = (
            f"tests/requirement-cases/generated/{requirement_id}.feature"
            if cases
            else "Not generated"
        )
        lines.append(
            f"| {issue_key} | {requirement_id} | {case_list} | {generated} |"
        )
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
    parser.add_argument("--issue", required=True, help="issue key in the fixture source")
    parser.add_argument(
        "--force",
        action="store_true",
        help="replace an existing work-item snapshot",
    )
    args = parser.parse_args()

    issue_key = args.issue.strip()
    if not ISSUE_KEY_PATTERN.fullmatch(issue_key):
        parser.error("issue key must use PROJECT-123 format")

    fixture_path = FIXTURES_DIR / f"{issue_key}.json"
    if not fixture_path.is_file():
        print(f"No fixture found for {issue_key}.", file=sys.stderr)
        print("This prototype is fixture-only; it does not connect to Jira.", file=sys.stderr)
        return 2

    raw = fixture_path.read_bytes()
    try:
        issue = json.loads(raw)
    except json.JSONDecodeError as error:
        print(f"Invalid fixture JSON: {error}", file=sys.stderr)
        return 2
    if issue.get("key") != issue_key:
        print(f"Fixture key mismatch: expected {issue_key}, got {issue.get('key')}", file=sys.stderr)
        return 2
    if issue.get("source") != "synthetic-fixture":
        print("Refusing a fixture that is not marked synthetic.", file=sys.stderr)
        return 2
    if not issue.get("url", "").startswith("https://jira.example.invalid/"):
        print("Fixture URL must use the non-routable example.invalid domain.", file=sys.stderr)
        return 2

    linked_requirements: list[tuple[str, Path, dict[str, str], str]] = []
    try:
        requirement_ids = issue.get("requirement_ids", [])
        if not requirement_ids:
            raise ValueError("issue has no linked requirement IDs")
        if len(requirement_ids) != len(set(requirement_ids)):
            raise ValueError("issue contains duplicate requirement IDs")
        for requirement_id in requirement_ids:
            path, metadata, body = load_requirement(requirement_id)
            linked_requirements.append((requirement_id, path, metadata, body))
    except (TypeError, ValueError) as error:
        print(f"Cannot import {issue_key}: {error}", file=sys.stderr)
        return 2

    output_path = WORK_ITEMS_DIR / f"{issue_key}.md"
    if output_path.exists() and not args.force:
        print(
            f"Refusing to overwrite {output_path.relative_to(ROOT)}; use --force after reviewing.",
            file=sys.stderr,
        )
        return 2

    WORK_ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        render_work_item(issue, hashlib.sha256(raw).hexdigest(), linked_requirements),
        encoding="utf-8",
    )
    print(f"Wrote {output_path.relative_to(ROOT)}")
    print("Source: synthetic fixture; network and Jira write operations: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
