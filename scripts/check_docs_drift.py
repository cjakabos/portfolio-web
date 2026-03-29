#!/usr/bin/env python3

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent


def read(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


def require_contains(content: str, needle: str, source: str, failures: list[str]) -> None:
    if needle not in content:
        failures.append(f"{source} is missing required text: {needle}")


def require_absent(content: str, needle: str, source: str, failures: list[str]) -> None:
    if needle in content:
        failures.append(f"{source} still contains forbidden text: {needle}")


def main() -> int:
    failures: list[str] = []

    readme = read("README.md")
    tests_readme = read("tests/README.md")
    workflow = read(".github/workflows/ci-tests.yml")
    compose = read("docker-compose.test.yml")
    smoke_paths = read("docs/platform/showcase-smoke-paths.md")
    platform_docs = read("docs/platform/README.md")

    for required in [
        "No CloudApp demo users are created by default.",
        "CLOUDAPP_SEED_DEMO_USERS_ENABLED=true",
        "docs/platform/",
        "showcase-architecture.md",
        "showcase-evidence-pack.md",
    ]:
        require_contains(readme, required, "README.md", failures)

    for forbidden in [
        "cloudadmin",
        "regularuser123",
        "pwd:",
        "Cypress",
        "cypress",
    ]:
        require_absent(readme, forbidden, "README.md", failures)

    for required in [
        "Playwright",
        "AI monitor behavior",
        "`test-ai-monitor-behavior`",
        "`monitor.spec.ts`",
        "Browser Surface Quality Gates",
        "CloudApp shell",
        "OpenMaps remote",
        "Jira remote",
        "MLOps remote",
        "Petstore remote",
        "ChatLLM remote",
        "AI monitor",
        "`test-openmaps-frontend`",
        "`test-jira-frontend`",
        "`test-mlops-frontend`",
        "`test-petstore-frontend`",
        "`test-chatllm-frontend`",
        "`module-federation.spec.ts`",
        "`mlops.spec.ts`",
        "python3 scripts/check_docs_drift.py",
        "Core showcase",
        "Extended showcase",
        "Optional security posture",
    ]:
        require_contains(tests_readme, required, "tests/README.md", failures)

    for required in [
        "docs-drift-checks:",
        "frontend-static-checks:",
        "ai-monitor-behavior-tests:",
        "python3 scripts/check_docs_drift.py",
        "test-ai-monitor-behavior",
        "Core Showcase",
        "Extended Showcase",
        "Optional Security",
        "Frontend Static",
        "AI Monitor (Behavior)",
    ]:
        require_contains(workflow, required, ".github/workflows/ci-tests.yml", failures)

    for required in [
        "10-minute demo",
        "Architect deep dive",
        "AI/operator tour",
        "`frontend-static-checks`",
        "`e2e-core-tests`",
        "`e2e-remote-tests`",
        "`ai-monitor-behavior-tests`",
    ]:
        require_contains(
            smoke_paths, required, "docs/platform/showcase-smoke-paths.md", failures
        )

    for required in [
        "showcase-architecture.md",
        "showcase-evidence-pack.md",
        "showcase-smoke-paths.md",
    ]:
        require_contains(platform_docs, required, "docs/platform/README.md", failures)

    for required in [
        "test-ai-monitor-behavior:",
        "./playwright-report-monitor:/e2e/playwright-report",
        "./test-results-monitor:/e2e/test-results",
    ]:
        require_contains(compose, required, "docker-compose.test.yml", failures)

    if failures:
        print("Docs drift check failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("Docs drift check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
