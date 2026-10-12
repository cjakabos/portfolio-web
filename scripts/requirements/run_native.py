#!/usr/bin/env python3
"""Run a native suite and bind its completion and report bytes to the checkout."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from record_execution import context, digest


def result_paths(folder, result):
    output = folder / result
    return sorted(output.glob("*.xml")) if output.is_dir() else ([output] if output.is_file() else [])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--results", type=Path, default=Path("/results"))
    parser.add_argument("--result", required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("native runner command is required")
    folder = args.results
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {"started_at": datetime.now(timezone.utc).isoformat(), "exit_code": None, "reports": {}, "command": command}
    run = folder / "run.json"
    # Invalidate a previous completion before installation or test discovery.
    run.write_text(json.dumps(manifest, indent=2) + "\n")
    for path in result_paths(folder, args.result):
        path.unlink()
    recorded = folder / "context.json"
    recorded.write_text(json.dumps(context(args.root), indent=2) + "\n")
    status = 1
    try:
        status = subprocess.run(command).returncode
        return status
    finally:
        manifest.update(completed_at=datetime.now(timezone.utc).isoformat(), exit_code=status,
                        context_sha256=digest(recorded),
                        reports={str(path.relative_to(folder)): digest(path)
                                 for path in result_paths(folder, args.result)})
        run.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
