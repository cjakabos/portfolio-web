#!/usr/bin/env python3
"""Check the incoming Git diff and exact-head independent GitHub review.

Local review JSON is diagnostic evidence, not authentication. CI obtains reviews
from GitHub using its read-only token; protected rules remain the trust anchor.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.request

from task_contract import ROOT, git, read_json, safe_path, validate

SELECTION = "work-items/agent-tasks/change-selection.json"


def check_scope(root, base, head, branch=None):
    base = git(root, "rev-parse", "--verify", base + "^{commit}").strip()
    head = git(root, "rev-parse", "--verify", head + "^{commit}").strip()
    git(root, "merge-base", "--is-ancestor", base, head)
    selection = read_json(root / SELECTION)
    if set(selection) != {"schema_version", "tasks"} or selection["schema_version"] != 1:
        raise ValueError("invalid task selection")
    paths = selection["tasks"]
    if not isinstance(paths, list) or not paths or len(paths) != len(set(paths)):
        raise ValueError("select unique applicable task records")
    scopes, identities = [], []
    for path in paths:
        path = safe_path(root, path)
        if not path.startswith("work-items/agent-tasks/") or path == SELECTION:
            raise ValueError("selection must reference task records")
        task = read_json(root / path)
        validate(task, root)
        git(root, "merge-base", "--is-ancestor", task["base_commit"], head)
        if branch is not None and task["branch"] != branch:
            raise ValueError("event branch differs from task branch")
        if "edit-scoped-files" not in task["authority"]["allowed_actions"]:
            raise ValueError("selected task does not permit edits")
        scopes.extend(safe_path(root, scope) for scope in task["authority"]["write_paths"])
        identities.append(task["id"])
    changed = sorted(filter(None, git(root, "diff", "--name-only", "--no-renames", "-z", base, head).split("\0")))
    fingerprints = {}
    for path in changed:
        path = safe_path(root, path)
        if not any(path == scope or path.startswith(scope + "/") for scope in scopes):
            raise ValueError(f"incoming change outside task scope: {path}")
        # Git object identity includes exact content, executable mode and symlinks.
        fingerprints[path] = git(root, "ls-tree", head, "--", path).strip() or "deleted"
    return {"base": base, "head": head, "tasks": identities, "changed_paths": changed,
            "diff_digest": hashlib.sha256(json.dumps(fingerprints, sort_keys=True).encode()).hexdigest()}


def check_reviews(reviews, head, author):
    """Latest decisions from trusted, independent humans; bots/self-review fail."""
    latest = {}
    for review in reviews:
        user = review.get("user") or {}
        if user.get("type") != "User" or review.get("author_association") not in {"OWNER", "MEMBER", "COLLABORATOR"}:
            continue
        login = user.get("login")
        if not login or login == author:
            continue
        if review.get("state") not in {"APPROVED", "CHANGES_REQUESTED", "DISMISSED"}:
            continue
        if review.get("id", 0) > latest.get(login, {}).get("id", -1):
            latest[login] = review
    if any(review["state"] == "CHANGES_REQUESTED" for review in latest.values()):
        raise ValueError("independent review has unresolved changes requested")
    approved = [review for review in latest.values()
                if review["state"] == "APPROVED" and review.get("commit_id") == head]
    if not approved:
        raise ValueError("missing independent human approval of the exact PR head")
    return [{"review_id": item["id"], "reviewer": item["user"]["login"],
             "reviewed_commit": item["commit_id"], "disposition": item["state"]} for item in approved]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("authenticated GitHub redirects are rejected")


def github_reviews(repository, number):
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository) or not number.isdigit():
        raise ValueError("invalid GitHub PR target")
    token = os.environ.get("GH_TOKEN")
    if not token:
        raise ValueError("CI read-only GitHub token unavailable")
    reviews = []
    opener = urllib.request.build_opener(NoRedirect)
    for page in range(1, 11):
        request = urllib.request.Request(
            f"https://api.github.com/repos/{repository}/pulls/{number}/reviews?per_page=100&page={page}",
            headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                     "User-Agent": "portfolio-adlc-gate"})
        with opener.open(request, timeout=15) as response:
            batch = json.load(response)
        if not isinstance(batch, list):
            raise ValueError("invalid GitHub reviews response")
        reviews.extend(batch)
        if len(batch) < 100:
            return reviews
    raise ValueError("review history exceeds bounded pagination")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--base-ref", required=True)
    parser.add_argument("--head-ref", default="HEAD")
    parser.add_argument("--branch")
    parser.add_argument("--author")
    sources = parser.add_mutually_exclusive_group(required=True)
    sources.add_argument("--github-pr", help="CI reads authenticated GitHub reviews")
    sources.add_argument("--reviews", type=Path, help="local diagnostic fixture, not authenticated approval")
    sources.add_argument("--scope-only", action="store_true", help="declarations only; never promotion evidence")
    parser.add_argument("--output", type=Path, default=Path("test-results/adlc-change/report.json"))
    args = parser.parse_args()
    report = {"status": "failed", "mode": "scope-only" if args.scope_only else "independent-review",
              "review_source": "GitHub API" if args.github_pr else "local declarations"}
    try:
        report.update(check_scope(args.root, args.base_ref, args.head_ref, args.branch))
        if not args.scope_only:
            if not args.author:
                raise ValueError("PR author identity is required")
            reviews = (github_reviews(os.environ.get("GITHUB_REPOSITORY", ""), args.github_pr)
                       if args.github_pr else read_json(args.reviews))
            report["reviews"] = check_reviews(reviews, report["head"], args.author)
        report["status"] = "passed"
    except (OSError, ValueError, KeyError, TypeError) as error:
        report["error"] = str(error)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return report["status"] != "passed"


if __name__ == "__main__":
    raise SystemExit(main())
