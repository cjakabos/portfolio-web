#!/usr/bin/env python3
"""Generate or check portable cases and their index from canonical Markdown."""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from model import ROOT, REQ_ID, artifacts, freshness_errors, load_requirements


def display_path(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=ROOT,
        help="repository containing canonical requirements",
    )
    parser.add_argument(
        "--id",
        help="generate one requirement; index always describes the full baseline",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=Path("tests/requirement-cases/generated")
    )
    parser.add_argument("--check", action="store_true", help="check without writing")
    args = parser.parse_args()
    root = args.root.resolve()
    output = (
        args.output_dir if args.output_dir.is_absolute() else root / args.output_dir
    )
    if args.id and not REQ_ID.fullmatch(args.id):
        parser.error("--id must use REQ-AREA-123 format")
    try:
        requirements = load_requirements(root)
        if args.id and not any(req.id == args.id for req in requirements):
            raise ValueError(f"unknown requirement: {args.id}")
        expected = artifacts(requirements, root)
        if args.check:
            errors = freshness_errors(output, expected)
            if errors:
                raise ValueError("\n".join(errors))
            print("Generated acceptance artifacts match canonical requirements.")
            return 0
        output.mkdir(parents=True, exist_ok=True)
        for name, content in expected.items():
            if args.id and name not in {"index.json", f"{args.id}.feature"}:
                continue
            path = output / name
            path.write_text(content, encoding="utf-8")
            print(f"Wrote {display_path(path, root)}")
        for path in output.glob("REQ-*.feature"):
            if path.name not in expected and (not args.id or path.stem == args.id):
                path.unlink()
                print(f"Removed {display_path(path, root)}")
        print(
            f'Generated {sum(len(req.cases) for req in requirements if req.status != "retired")} acceptance cases.'
        )
        return 0
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
