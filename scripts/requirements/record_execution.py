#!/usr/bin/env python3
"""Record the checkout inputs for a runner's JUnit XML without extra dependencies."""
import argparse
import hashlib
import json
import os
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def context(root):
    mapping = root / "requirements/test-map.json"
    data = json.loads(mapping.read_text())
    paths = {
        target["path"]
        for entry in data["cases"].values()
        for target in entry["targets"]
    }
    return {
        "git_sha": os.environ.get("TRACEABILITY_COMMIT", "unknown"),
        "test_map": digest(mapping),
        "requirements": {
            path.name: digest(path)
            for path in sorted((root / "requirements").glob("REQ-*.md"))
        },
        "harness_sources": {
            str(path.relative_to(root)): digest(path)
            for path in sorted((root / "scripts/requirements").glob("*.py"))
        },
        "ai_sources": {
            str(path.relative_to(root)): digest(path)
            for path in sorted(
                (root / "ai-orchestration/ai-orchestration-layer/src").rglob("*.py")
            )
        },
        "test_sources": {path: digest(root / path) for path in sorted(paths)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[2]
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(context(args.root), indent=2) + "\n")


if __name__ == "__main__":
    main()
