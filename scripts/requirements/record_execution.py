#!/usr/bin/env python3
"""Record application, test and runner inputs without extra dependencies."""
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
    # Prune build/dependency directories before walking. Implementation changes
    # must invalidate evidence even when mapped test declarations stay the same.
    inputs = []
    excluded = {"node_modules", "target", "dist", "build", ".next", "coverage",
                "__pycache__", ".pytest_cache", ".git", "test-results", "playwright-report", "Pods", ".gradle"}
    for directory in ("backend", "frontend", "packages", "ai-orchestration", "tests", "scripts", ".github/workflows"):
        for parent, children, files in os.walk(root / directory):
            children[:] = sorted(set(children) - excluded)
            inputs.extend(Path(parent) / name for name in sorted(files)
                          if not name.startswith(".env") and not name.endswith((".pyc", ".tsbuildinfo", ".log")))
    inputs.extend(path for pattern in ("Dockerfile*", "docker-compose*.yml", "package*.json", ".npmrc")
                  for path in root.glob(pattern) if path.is_file())
    return {
        "git_sha": os.environ.get("TRACEABILITY_COMMIT", "unknown"),
        "test_map": digest(mapping),
        "requirements": {
            path.name: digest(path)
            for path in sorted((root / "requirements").glob("REQ-*.md"))
        },
        "intent_records": {
            str(path.relative_to(root)): digest(path)
            for path in sorted([
                *([root / "requirements/baseline.json"] if (root / "requirements/baseline.json").is_file() else []),
                *(root / "requirements/reviews").rglob("*.md"),
            ])
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
        "execution_inputs": {str(path.relative_to(root)): digest(path) for path in sorted(set(inputs))},
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
