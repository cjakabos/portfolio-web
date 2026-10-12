"""Source adapters for Jira intake; authenticated network access is GET-only."""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener
import uuid

ISSUE_KEY = re.compile(r"[A-Z][A-Z0-9_]*-\d+")
REQUIREMENT_ID = re.compile(r"REQ-[A-Z0-9]+-\d+")
REQUIREMENT_IN_TEXT = re.compile(r"(?<![\w-])REQ-[A-Z0-9]+-\d+(?![\w-])")
CUSTOM_FIELD = re.compile(r"customfield_\d+")
MAX_RESPONSE_BYTES = 5 * 1024 * 1024


@dataclass(frozen=True)
class IssueSnapshot:
    issue: dict[str, Any]
    fingerprint: str


def load_fixture(root: Path, key: str) -> IssueSnapshot:
    path = root / "fixtures/jira" / f"{key}.json"
    if not path.is_file():
        raise ValueError(f"No fixture found for {key}. Use --source jira for live intake.")
    raw = path.read_bytes()
    try:
        issue = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ValueError("Invalid fixture JSON.") from None
    if not isinstance(issue, dict):
        raise ValueError("Fixture must be an object with a non-empty summary.")
    if issue.get("key") != key:
        raise ValueError(f"Fixture key mismatch: expected {key}.")
    if issue.get("source") != "synthetic-fixture":
        raise ValueError("Refusing a fixture that is not marked synthetic.")
    if not isinstance(issue.get("url"), str) or not issue["url"].startswith("https://jira.example.invalid/"):
        raise ValueError("Fixture URL must use the non-routable example.invalid domain.")
    return IssueSnapshot(issue, hashlib.sha256(raw).hexdigest())


def https_base(value: str, setting: str) -> str:
    """Credentials belong in headers, never in URLs or redirect destinations."""
    try:
        parsed = urlsplit(value)
        valid = (parsed.scheme == "https" and parsed.hostname and not parsed.username
                 and not parsed.password and not parsed.query and not parsed.fragment)
        parsed.port  # Validate malformed/non-numeric ports too.
    except ValueError:
        valid = False
    if not valid or any(char.isspace() for char in value):
        raise ValueError(f"{setting} must be an HTTPS base URL without credentials, query or fragment.")
    return value.rstrip("/")


@dataclass(frozen=True)
class JiraSettings:
    site_url: str
    api_url: str
    authorization: str = field(repr=False)
    api_version: str
    requirements_field: str
    ca_cert: str

    @classmethod
    def from_environment(cls) -> JiraSettings:
        site_url = https_base(os.environ.get("JIRA_INTAKE_URL", "").strip(), "JIRA_INTAKE_URL")
        auth = os.environ.get("JIRA_INTAKE_AUTH", "basic").strip().lower()
        if auth not in {"basic", "bearer"}:
            raise ValueError("JIRA_INTAKE_AUTH must be basic or bearer.")
        token = os.environ.get("JIRA_INTAKE_API_TOKEN", "").strip()
        token_file = os.environ.get("JIRA_INTAKE_API_TOKEN_FILE", "").strip()
        if token and token_file:
            raise ValueError("Set only one of JIRA_INTAKE_API_TOKEN and JIRA_INTAKE_API_TOKEN_FILE.")
        if token_file:
            try:
                token = Path(token_file).read_text(encoding="utf-8").strip()
            except (OSError, UnicodeError):
                raise ValueError("Cannot read JIRA_INTAKE_API_TOKEN_FILE.") from None
        if not token or token in {"CHANGE_ME", "your-token"} or "\r" in token or "\n" in token:
            raise ValueError("Set a valid JIRA_INTAKE_API_TOKEN or JIRA_INTAKE_API_TOKEN_FILE.")
        if auth == "basic":
            email = os.environ.get("JIRA_INTAKE_EMAIL", "").strip()
            if not email or ":" in email or any(char.isspace() for char in email):
                raise ValueError("Set JIRA_INTAKE_EMAIL for basic authentication.")
            encoded = base64.b64encode(f"{email}:{token}".encode()).decode("ascii")
            authorization = f"Basic {encoded}"
        else:
            authorization = f"Bearer {token}"
        version = os.environ.get("JIRA_INTAKE_API_VERSION", "").strip() or ("3" if auth == "basic" else "2")
        if version not in {"2", "3"}:
            raise ValueError("JIRA_INTAKE_API_VERSION must be 2 or 3.")
        cloud_id = os.environ.get("JIRA_INTAKE_CLOUD_ID", "").strip()
        api_url = os.environ.get("JIRA_INTAKE_API_BASE_URL", "").strip()
        if cloud_id and api_url:
            raise ValueError("Set only one of JIRA_INTAKE_CLOUD_ID and JIRA_INTAKE_API_BASE_URL.")
        if cloud_id:
            try:
                cloud_id = str(uuid.UUID(cloud_id))
            except ValueError:
                raise ValueError("JIRA_INTAKE_CLOUD_ID must be the site's UUID.") from None
            api_url = f"https://api.atlassian.com/ex/jira/{cloud_id}"
        api_url = https_base(api_url or site_url, "JIRA_INTAKE_API_BASE_URL")
        field = os.environ.get("JIRA_INTAKE_REQUIREMENTS_FIELD", "").strip()
        if field and not CUSTOM_FIELD.fullmatch(field):
            raise ValueError("JIRA_INTAKE_REQUIREMENTS_FIELD must use customfield_12345 format.")
        return cls(site_url, api_url, authorization, version, field,
                   os.environ.get("JIRA_INTAKE_CA_CERT", "").strip())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        # A Jira or proxy redirect must never forward authentication elsewhere.
        return None


def _retry_delay(value: str | None) -> float:
    if value:
        try:
            delay = float(value)
        except ValueError:
            try:
                at = parsedate_to_datetime(value)
                if at.tzinfo is None:
                    at = at.replace(tzinfo=timezone.utc)
                delay = (at - datetime.now(timezone.utc)).total_seconds()
            except (ValueError, TypeError, OverflowError):
                raise ValueError("Jira requested a retry with an invalid Retry-After header; retry later.") from None
        if not 0 <= delay <= 30:
            raise ValueError("Jira requested a longer retry delay; retry the intake later.")
        return delay
    return 1.0


def _read_issue(settings: JiraSettings, key: str) -> bytes:
    fields = ["summary", "description", "issuetype", "status", "priority", "created", "updated", "labels"]
    if settings.requirements_field:
        fields.append(settings.requirements_field)
    url = (f"{settings.api_url}/rest/api/{settings.api_version}/issue/{quote(key, safe='')}?"
           + urlencode({"fields": ",".join(fields)}))
    request = Request(url, headers={"Accept": "application/json", "Authorization": settings.authorization,
                                   "User-Agent": "portfolio-requirements-intake/1"}, method="GET")
    try:
        context = ssl.create_default_context(cafile=settings.ca_cert or None)
        opener = build_opener(NoRedirect(), HTTPSHandler(context=context))
    except (OSError, ssl.SSLError):
        raise ValueError("Cannot configure Jira TLS trust; check JIRA_INTAKE_CA_CERT.") from None
    for attempt in range(3):
        try:
            with opener.open(request, timeout=15) as response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise ValueError("Jira issue response exceeds the 5 MiB intake limit.")
                return raw
        except HTTPError as error:
            status = error.code
            retry_after = error.headers.get("Retry-After") if error.headers else None
            error.close()
            if status in {429, 502, 503, 504} and attempt < 2:
                time.sleep(_retry_delay(retry_after) if retry_after else float(attempt + 1))
                continue
            messages = {
                401: "Jira authentication failed; check the intake identity and token expiry.",
                403: "Jira denied access; check read scopes and project/issue permissions.",
                404: "Jira issue was not found or is not visible to this identity.",
                429: "Jira rate limit remains active; retry the intake later.",
            }
            # Do not echo response bodies or headers: they can contain credentials
            # or confidential issue data. Redirects are errors, not automatic hops.
            raise ValueError(messages.get(status, f"Jira GET failed (HTTP {status}); check the API URL and Jira availability.")) from None
        except (URLError, TimeoutError, OSError):
            raise ValueError("Cannot reach Jira over HTTPS; check the URL, network and certificate trust.") from None
    raise ValueError("Jira GET did not complete.")


def jira_text(value: Any) -> str:
    """Read plain descriptions (v2) and Atlassian Document Format (v3)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        raise ValueError("Jira description must be text or an Atlassian document.")
    kind = value.get("type")
    attrs = value.get("attrs") or {}
    if not isinstance(attrs, dict):
        raise ValueError("Invalid Jira document attributes.")
    if kind == "text":
        text = value.get("text", "")
        if not isinstance(text, str):
            raise ValueError("Invalid Jira document text.")
        return text
    if kind == "hardBreak":
        return "\n"
    if kind in {"mention", "emoji", "status", "date"}:
        return str(attrs.get("text") or attrs.get("shortName") or attrs.get("timestamp") or attrs.get("id") or "")
    if kind in {"inlineCard", "blockCard"}:
        return str(attrs.get("url") or "")
    children = value.get("content", [])
    if not isinstance(children, list):
        raise ValueError("Invalid Jira document content.")
    text = "".join(jira_text(child) for child in children)
    if kind in {"paragraph", "heading", "listItem", "codeBlock", "blockquote", "tableRow"}:
        text += "\n"
    if kind in {"tableCell", "tableHeader"}:
        text += "\t"
    return text


def _field_ids(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return REQUIREMENT_IN_TEXT.findall(value)
    if isinstance(value, list):
        return [identity for item in value for identity in _field_ids(item)]
    if isinstance(value, dict):
        if value.get("type") == "doc":
            return _field_ids(jira_text(value))
        return _field_ids(value.get("value") or value.get("name"))
    raise ValueError("The Jira requirements field must contain text or selected requirement IDs.")


def load_jira(key: str) -> IssueSnapshot:
    settings = JiraSettings.from_environment()
    raw = _read_issue(settings, key)
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ValueError("Jira returned non-JSON data; check the API URL and authentication configuration.") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("fields"), dict):
        raise ValueError("Jira returned an invalid issue object.")
    canonical_key = payload.get("key")
    if not isinstance(canonical_key, str) or not ISSUE_KEY.fullmatch(canonical_key):
        raise ValueError("Jira returned an invalid issue key.")
    fields = payload["fields"]
    labels = fields.get("labels") or []
    if not isinstance(labels, list) or any(not isinstance(label, str) for label in labels):
        raise ValueError("Jira returned invalid issue labels.")
    identities = [label for label in labels if REQUIREMENT_ID.fullmatch(label)]
    if settings.requirements_field:
        identities.extend(_field_ids(fields.get(settings.requirements_field)))
    def name(field):
        item = fields.get(field)
        return str(item.get("name") or "") if isinstance(item, dict) else ""
    issue = {
        "source": "read-only-jira",
        "key": canonical_key,
        "url": f"{settings.site_url}/browse/{canonical_key}",
        "summary": fields.get("summary"),
        "description": jira_text(fields.get("description")).strip(),
        "issue_type": name("issuetype"), "status": name("status"), "priority": name("priority"),
        "created_at": fields.get("created") or "", "updated_at": fields.get("updated") or "",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "requirement_ids": list(dict.fromkeys(identities)),
        "requirement_link_source": "Jira labels" + (f" + {settings.requirements_field}" if settings.requirements_field else ""),
        "proposed_requirement_change": "",
    }
    if canonical_key != key:
        issue["requested_key"] = key
    return IssueSnapshot(issue, hashlib.sha256(raw).hexdigest())
