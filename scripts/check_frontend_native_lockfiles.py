#!/usr/bin/env python3
"""Fail if frontend lockfiles are missing Linux native package entries.

These Dockerfile_FE-based builds rely on optional native Node packages such as:
- Next.js SWC binaries
- Tailwind oxide binaries

macOS-generated lockfiles can occasionally omit the Linux entries from the
package-lock `packages` map, which then breaks Docker builds later in CI.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

LOCKFILE_REQUIREMENTS = {
    "frontend/cloudapp-shell/package-lock.json": [
        "node_modules/@next/swc-linux-arm64-musl",
        "node_modules/@next/swc-linux-x64-musl",
        "node_modules/@tailwindcss/oxide-linux-arm64-musl",
        "node_modules/@tailwindcss/oxide-linux-x64-musl",
    ],
    "frontend/remote/chatllm/package-lock.json": [
        "node_modules/@next/swc-linux-arm64-musl",
        "node_modules/@next/swc-linux-x64-musl",
    ],
    "frontend/remote/jira/package-lock.json": [
        "node_modules/@next/swc-linux-arm64-musl",
        "node_modules/@next/swc-linux-x64-musl",
    ],
    "frontend/remote/moduletemplate/package-lock.json": [
        "node_modules/@next/swc-linux-arm64-musl",
        "node_modules/@next/swc-linux-x64-musl",
    ],
    "frontend/remote/petstore/package-lock.json": [
        "node_modules/@next/swc-linux-arm64-musl",
        "node_modules/@next/swc-linux-x64-musl",
    ],
    "frontend/remote/openmaps/package-lock.json": [
        "node_modules/@tailwindcss/oxide-linux-arm64-musl",
        "node_modules/@tailwindcss/oxide-linux-x64-musl",
    ],
    "frontend/remote/mlops/package-lock.json": [
        "node_modules/@tailwindcss/oxide-linux-arm64-musl",
        "node_modules/@tailwindcss/oxide-linux-x64-musl",
    ],
}


def main() -> int:
    failures: list[str] = []

    for relative_path, required_packages in LOCKFILE_REQUIREMENTS.items():
        lockfile_path = REPO_ROOT / relative_path
        if not lockfile_path.exists():
            failures.append(f"{relative_path}: missing lockfile")
            continue

        with lockfile_path.open("r", encoding="utf-8") as handle:
            lockfile = json.load(handle)

        packages = lockfile.get("packages")
        if not isinstance(packages, dict):
            failures.append(f"{relative_path}: missing top-level 'packages' map")
            continue

        missing = [package for package in required_packages if package not in packages]
        if missing:
            failures.append(
                f"{relative_path}: missing native package entries -> "
                + ", ".join(missing)
            )

    if failures:
        print("Frontend lockfile native package check failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        print(
            "Regenerate the affected lockfile on a Linux-compatible dependency set "
            "or reinstall with npm so the Linux native packages are recorded.",
            file=sys.stderr,
        )
        return 1

    print("Frontend lockfile native package check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
