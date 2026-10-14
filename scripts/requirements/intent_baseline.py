"""Validate recorded human acceptance separately from coverage and execution."""
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import yaml
from model import UniqueKeyLoader


def unique_json(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_decision(path):
    text = path.read_text()
    match = re.match(r"\A---\n(.*?)\n---(?:\n|\Z)", text, re.S)
    if not match:
        raise ValueError("decision record requires YAML front matter")
    decision = yaml.load(match[1], Loader=UniqueKeyLoader)
    if (not isinstance(decision, dict) or set(decision) != {
            "schema_version", "id", "status", "decided_by", "decided_on", "requirements",
            "requirement_digests"
        } or type(decision["schema_version"]) is not int or decision["schema_version"] != 1
            or decision["status"] != "accepted"
            or not isinstance(decision["id"], str) or not decision["id"].strip()
            or not isinstance(decision["requirements"], list)
            or not decision["requirements"]
            or any(not isinstance(identity, str) for identity in decision["requirements"])
            or len(decision["requirements"]) != len(set(decision["requirements"]))
            or not isinstance(decision["requirement_digests"], dict)
            or set(decision["requirement_digests"]) != set(decision["requirements"])):
        raise ValueError("decision record must contain an accepted decision with unique requirement IDs")
    return decision


def validate_intent(root, requirements, required=False):
    statuses = {requirement.id: requirement.status for requirement in requirements}
    report = {
        "requirements": statuses,
        "counts": dict(Counter(statuses.values())),
        "baseline": None,
    }
    errors = []
    accepted = {identity for identity, status in statuses.items() if status == "accepted"}
    path = root / "requirements/baseline.json"
    if not path.is_file():
        if required or accepted:
            errors.append("accepted product intent requires requirements/baseline.json")
        return errors, report
    try:
        raw = path.read_bytes()
        baseline = json.loads(raw, object_pairs_hook=unique_json)
        if (not isinstance(baseline, dict)
                or set(baseline) != {"schema_version", "requirements"}
                or type(baseline["schema_version"]) is not int
                or baseline["schema_version"] != 1
                or not isinstance(baseline["requirements"], dict)
                or not baseline["requirements"]):
            raise ValueError("baseline requires schema_version=1 and non-empty requirements")
        entries = baseline["requirements"]
        known = {requirement.id: requirement for requirement in requirements}
        decisions = {}
        for identity, entry in entries.items():
            try:
                if identity not in known:
                    raise ValueError("unknown baseline requirement")
                requirement = known[identity]
                if requirement.status != "accepted":
                    raise ValueError(f"baseline requirement is {requirement.status}, not accepted")
                if not isinstance(entry, dict) or set(entry) != {
                    "digest", "accepted_by", "accepted_on", "decision"
                }:
                    raise ValueError("baseline entry requires digest, accepted_by, accepted_on, decision")
                if any(not isinstance(value, str) or not value.strip() for value in entry.values()):
                    raise ValueError("baseline entry fields must be non-empty strings")
                if not re.fullmatch(r"[0-9a-f]{64}", entry["digest"]):
                    raise ValueError("baseline digest must be a SHA-256")
                if entry["digest"] != requirement.digest:
                    raise ValueError("accepted revision changed; human review and baseline update required")
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["accepted_on"]):
                    raise ValueError("accepted_on must use YYYY-MM-DD")
                date.fromisoformat(entry["accepted_on"])
                decision = Path(entry["decision"])
                if (decision.is_absolute() or ".." in decision.parts
                        or decision.parts[:2] != ("requirements", "reviews")
                        or decision.suffix != ".md"
                        or not (root / decision).resolve().is_relative_to(root.resolve())
                        or not (root / decision).is_file()):
                    raise ValueError("decision must reference an existing requirements/reviews Markdown file")
                if requirement.metadata.get("review") != entry["decision"]:
                    raise ValueError("accepted requirement review must link its baseline decision record")
                if decision not in decisions:
                    decisions[decision] = load_decision(root / decision)
                approval = decisions[decision]
                if (approval["decided_by"] != entry["accepted_by"]
                        or approval["decided_on"] != entry["accepted_on"]
                        or identity not in approval["requirements"]
                        or approval["requirement_digests"].get(identity) != entry["digest"]):
                    raise ValueError("baseline entry does not match its human decision record")
            except (OSError, ValueError, TypeError, yaml.YAMLError) as error:
                errors.append(f"{identity}: {error}")
        errors.extend(
            f"{identity}: accepted requirement has no recorded baseline revision"
            for identity in sorted(accepted - entries.keys())
        )
        if not errors:
            report["baseline"] = {
                "path": "requirements/baseline.json",
                "digest": hashlib.sha256(raw).hexdigest(),
                "requirements": entries,
            }
    except (OSError, ValueError, TypeError, KeyError) as error:
        errors.append(f"product intent baseline: {error}")
    return errors, report


def promotion_errors(intent, identities):
    """Selected release requirements must have accepted, recorded intent."""
    errors = []
    for identity in identities:
        status = intent["requirements"].get(identity)
        if status != "accepted":
            errors.append(f"{identity}: promotion requires accepted intent; status={status or 'unknown'}")
    return errors
