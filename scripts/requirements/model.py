"""Canonical requirement schema and Cucumber parsing shared by the CLI tools."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from gherkin.parser import Parser

ROOT = Path(__file__).resolve().parents[2]
REQ_ID = re.compile(r"REQ-[A-Z0-9]+-\d+")


class UniqueKeyLoader(yaml.SafeLoader):
    """Reject duplicate YAML keys rather than silently taking the last value."""


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str) or key in result:
            raise ValueError(f"duplicate or non-string YAML key: {key!r}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping
)


@dataclass(frozen=True)
class Case:
    id: str
    name: str
    digest: str


@dataclass(frozen=True)
class Requirement:
    path: Path
    metadata: dict[str, Any]
    body: str
    feature: str
    digest: str
    cases: tuple[Case, ...]

    @property
    def id(self):
        return self.metadata["id"]

    @property
    def status(self):
        return self.metadata["status"]


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def front_matter(text: str) -> tuple[dict[str, Any], str]:
    match = re.match(r"\A---\n(.*?)\n---(?:\n|\Z)(.*)\Z", text, re.S)
    if not match:
        raise ValueError("missing or unterminated YAML front matter")
    try:
        metadata = yaml.load(match[1], Loader=UniqueKeyLoader)
    except yaml.YAMLError as error:
        raise ValueError(f"invalid YAML: {error}") from error
    if not isinstance(metadata, dict):
        raise ValueError("front matter must be a mapping")
    allowed = {"schema_version", "id", "title", "status", "owner", "basis", "review"}
    if metadata.keys() - allowed:
        raise ValueError(
            f"unknown metadata fields: {sorted(metadata.keys() - allowed)}"
        )
    if (
        type(metadata.get("schema_version")) is not int
        or metadata["schema_version"] != 1
    ):
        raise ValueError("schema_version must be 1")
    for key in ("id", "title", "status", "owner"):
        if not isinstance(metadata.get(key), str) or not metadata[key].strip():
            raise ValueError(f"{key} must be a non-empty string")
    for key in ("basis", "review"):
        if key in metadata and not isinstance(metadata[key], str):
            raise ValueError(f"{key} must be a string")
    if not REQ_ID.fullmatch(metadata["id"]):
        raise ValueError("invalid requirement ID")
    if metadata["status"] not in {"proposed", "accepted", "retired"}:
        raise ValueError("status must be proposed, accepted, or retired")
    return metadata, match[2]


def semantic(value):
    if isinstance(value, dict):
        return {
            key: semantic(item)
            for key, item in value.items()
            if key not in {"id", "location"}
        }
    if isinstance(value, list):
        return [semantic(item) for item in value]
    return value


def parse_feature(
    body: str, requirement_id: str, digest: str
) -> tuple[str, tuple[Case, ...]]:
    blocks = re.findall(r"(?ms)^```gherkin[ \t]*\n(.*?)^```[ \t]*$", body)
    if len(blocks) != 1:
        raise ValueError("exactly one Gherkin fenced block is required")
    feature_text = blocks[0].strip()
    try:
        feature = Parser().parse(feature_text).get("feature")
    except Exception as error:
        raise ValueError(f"invalid Gherkin: {error}") from error
    if not feature:
        raise ValueError("Gherkin must contain one Feature")
    tags = [tag["name"] for tag in feature["tags"]]
    if tags.count(f"@{requirement_id}") != 1 or any(
        tag.startswith("@AC-") for tag in tags
    ):
        raise ValueError("Feature needs its requirement tag and no acceptance tags")
    if any(tag.startswith("@REQ-") and tag != f"@{requirement_id}" for tag in tags):
        raise ValueError("Feature contains another requirement's tag")
    cases = []

    def visit(children):
        for child in children:
            if "rule" in child:
                rule = child["rule"]
                if any(
                    tag["name"].startswith(("@AC-", "@REQ-"))
                    for tag in rule.get("tags", [])
                ):
                    raise ValueError(
                        "requirement and acceptance tags must not be attached to Rule"
                    )
                visit(rule["children"])
            elif "scenario" in child:
                scenario = child["scenario"]
                case_tags = [
                    tag["name"][1:]
                    for tag in scenario["tags"]
                    if tag["name"].startswith("@AC-")
                ]
                if len(case_tags) != 1 or not re.fullmatch(
                    rf"AC-{re.escape(requirement_id)}-\d+", case_tags[0]
                ):
                    raise ValueError(
                        f"{scenario['name']}: exactly one acceptance tag belonging to {requirement_id} is required"
                    )
                if any(tag["name"].startswith("@REQ-") for tag in scenario["tags"]):
                    raise ValueError("requirement tag belongs on Feature")
                if not scenario["name"].strip() or not scenario["steps"]:
                    raise ValueError("Scenario needs a name and steps")
                if scenario["keyword"] in {
                    "Scenario Outline",
                    "Scenario Template",
                } and not scenario.get("examples"):
                    raise ValueError("Scenario Outline needs Examples")
                for examples in scenario.get("examples", []):
                    if any(
                        tag["name"].startswith(("@AC-", "@REQ-"))
                        for tag in examples.get("tags", [])
                    ):
                        raise ValueError(
                            "acceptance and requirement tags must not be attached to Examples"
                        )
                    if not examples.get("tableHeader") or not examples.get("tableBody"):
                        raise ValueError("Examples needs a header and at least one row")
                value = json.dumps(
                    {"requirement": digest, "scenario": semantic(scenario)},
                    sort_keys=True,
                ).encode()
                cases.append(Case(case_tags[0], scenario["name"], sha256(value)))

    visit(feature["children"])
    if not cases or len({case.id for case in cases}) != len(cases):
        raise ValueError("Feature needs scenarios with unique acceptance IDs")
    return feature_text, tuple(cases)


def parse_requirement(path: Path) -> Requirement:
    try:
        raw = path.read_bytes()
        metadata, body = front_matter(raw.decode("utf-8"))
        if path.stem != metadata["id"]:
            raise ValueError("filename must match requirement ID")
        digest = sha256(raw)
        if metadata["status"] == "retired" and "```gherkin" not in body:
            feature, cases = "", ()
        else:
            feature, cases = parse_feature(body, metadata["id"], digest)
        return Requirement(path, metadata, body, feature, digest, cases)
    except (OSError, UnicodeError, ValueError) as error:
        raise ValueError(f"{path.name}: {error}") from error


def load_requirements(root: Path = ROOT) -> list[Requirement]:
    paths = sorted((root / "requirements").glob("REQ-*.md"))
    if not paths:
        raise ValueError("No matching requirement files found")
    requirements = [parse_requirement(path) for path in paths]
    seen = set()
    for requirement in requirements:
        for case in requirement.cases:
            if case.id in seen:
                raise ValueError(
                    f"duplicate acceptance ID across requirements: {case.id}"
                )
            seen.add(case.id)
    return requirements


def render_feature(requirement: Requirement, root: Path = ROOT) -> str:
    source = requirement.path.relative_to(root).as_posix()
    return (
        f"# Generated from {source}. Do not edit this file directly.\n"
        f"# Requirement: {requirement.id}\n"
        f"# Requirement status at generation: {requirement.status}\n"
        f"# Requirement SHA-256: {requirement.digest}\n\n{requirement.feature}\n"
    )


def artifacts(requirements: list[Requirement], root: Path = ROOT) -> dict[str, str]:
    result = {
        f"{req.id}.feature": render_feature(req, root)
        for req in requirements
        if req.status != "retired"
    }
    index = {
        "schema_version": 1,
        "requirements": [
            {
                "id": req.id,
                "status": req.status,
                "source": req.path.relative_to(root).as_posix(),
                "digest": req.digest,
                "cases": [
                    {"id": case.id, "name": case.name, "digest": case.digest}
                    for case in req.cases
                ],
            }
            for req in requirements
            if req.status != "retired"
        ],
    }
    result["index.json"] = json.dumps(index, indent=2) + "\n"
    return result


def freshness_errors(output: Path, expected: dict[str, str]) -> list[str]:
    errors = []
    for name, content in expected.items():
        path = output / name
        if not path.is_file() or path.read_text(encoding="utf-8") != content:
            errors.append(
                f"stale or missing generated artifact: {name}; regenerate from Markdown"
            )
    for path in output.glob("REQ-*.feature"):
        if path.name not in expected:
            errors.append(f"orphaned generated artifact: {path.name}")
    return errors
