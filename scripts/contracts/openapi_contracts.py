#!/usr/bin/env python3
"""
OpenAPI contract governance utilities.

Supports:
- exporting normalized OpenAPI snapshots from live services
- checking snapshots for drift
- generating lightweight typed TypeScript operation clients from snapshots
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SNAPSHOT_DIR = ROOT / "contracts" / "openapi"
DEFAULT_MANIFEST_PATH = DEFAULT_SNAPSHOT_DIR / "manifest.json"
DEFAULT_TS_OUT_DIR = ROOT / "packages" / "contracts" / "src"

HTTP_METHODS = ("get", "post", "put", "patch", "delete", "options", "head")
PATH_PARAM_RE = re.compile(r"{([^}/]+)}")

TARGETS = {
    "cloudapp": os.getenv("CONTRACT_CLOUDAPP_OPENAPI_URL", "http://test-cloudapp:8099/cloudapp/v3/api-docs"),
    "vehicles": os.getenv("CONTRACT_VEHICLES_OPENAPI_URL", "http://test-vehicles:8880/vehicles/v3/api-docs"),
    "petstore": os.getenv("CONTRACT_PETSTORE_OPENAPI_URL", "http://test-petstore:8083/petstore/v3/api-docs"),
}


def _fetch_json(url: str, retries: int = 12, delay_sec: float = 2.0) -> dict[str, Any]:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                if response.status != 200:
                    raise RuntimeError(f"Unexpected status {response.status} for {url}")
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            last_err = exc
            if attempt == retries:
                break
            time.sleep(delay_sec)
    raise RuntimeError(f"Failed to fetch OpenAPI JSON from {url}: {last_err}")


def _normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        normalized = {}
        for key in sorted(obj.keys()):
            if key == "servers":
                # Host-specific and environment-dependent.
                continue
            normalized[key] = _normalize(obj[key])
        return normalized
    if isinstance(obj, list):
        # Preserve list order by default (operation/response order can be meaningful).
        return [_normalize(v) for v in obj]
    return obj


def _json_dumps(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=True) + "\n"


def _iter_snapshot_paths(snapshot_dir: Path, manifest_path: Path) -> list[Path]:
    manifest_resolved = manifest_path.resolve()
    return [
        path
        for path in sorted(snapshot_dir.glob("*.json"))
        if path.resolve() != manifest_resolved
    ]


def validate_contract_manifest(snapshot_dir: Path, manifest_path: Path) -> tuple[dict[str, Any] | None, int]:
    if not manifest_path.exists():
        print(f"[manifest] missing manifest: {manifest_path}", file=sys.stderr)
        return None, 1

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[manifest] invalid JSON in {manifest_path}: {exc}", file=sys.stderr)
        return None, 1

    failures = 0
    if manifest.get("schemaVersion") != 1:
        print("[manifest] schemaVersion must be 1", file=sys.stderr)
        failures += 1

    services = manifest.get("services")
    if not isinstance(services, dict):
        print("[manifest] services must be an object", file=sys.stderr)
        return manifest, failures + 1

    snapshot_paths = _iter_snapshot_paths(snapshot_dir, manifest_path)
    snapshot_names = {path.stem for path in snapshot_paths}
    manifest_names = set(services.keys())

    missing_from_manifest = sorted(snapshot_names - manifest_names)
    extra_in_manifest = sorted(manifest_names - snapshot_names)
    if missing_from_manifest:
        print(
            f"[manifest] services missing from manifest: {', '.join(missing_from_manifest)}",
            file=sys.stderr,
        )
        failures += 1
    if extra_in_manifest:
        print(
            f"[manifest] manifest has entries without snapshots: {', '.join(extra_in_manifest)}",
            file=sys.stderr,
        )
        failures += 1

    for snapshot_path in snapshot_paths:
        service_name = snapshot_path.stem
        service_manifest = services.get(service_name)
        if not isinstance(service_manifest, dict):
            print(
                f"[manifest] service entry must be an object: {service_name}",
                file=sys.stderr,
            )
            failures += 1
            continue

        spec = json.loads(snapshot_path.read_text(encoding="utf-8"))
        info = spec.get("info", {}) if isinstance(spec.get("info"), dict) else {}
        source_title = str(info.get("title") or "")
        upstream_version = str(info.get("version") or "")

        revision = service_manifest.get("snapshotRevision")
        if not isinstance(revision, int) or revision < 1:
            print(
                f"[manifest] snapshotRevision must be a positive integer for {service_name}",
                file=sys.stderr,
            )
            failures += 1

        owner = service_manifest.get("owner")
        if not isinstance(owner, str) or not owner.strip():
            print(
                f"[manifest] owner must be a non-empty string for {service_name}",
                file=sys.stderr,
            )
            failures += 1

        release_critical = service_manifest.get("releaseCritical")
        if not isinstance(release_critical, bool):
            print(
                f"[manifest] releaseCritical must be a boolean for {service_name}",
                file=sys.stderr,
            )
            failures += 1

        if service_manifest.get("sourceTitle") != source_title:
            print(
                f"[manifest] sourceTitle mismatch for {service_name}: "
                f"expected {source_title!r}",
                file=sys.stderr,
            )
            failures += 1

        if service_manifest.get("upstreamVersion") != upstream_version:
            print(
                f"[manifest] upstreamVersion mismatch for {service_name}: "
                f"expected {upstream_version!r}",
                file=sys.stderr,
            )
            failures += 1

    if failures == 0:
        print(f"[manifest] {manifest_path.name}: OK")
    return manifest, failures


def export_snapshots(snapshot_dir: Path) -> int:
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    for name, url in TARGETS.items():
        raw = _fetch_json(url)
        normalized = _normalize(raw)
        out_path = snapshot_dir / f"{name}.json"
        out_path.write_text(_json_dumps(normalized), encoding="utf-8")
        print(f"[export] {name}: {url} -> {out_path}")
    return 0


def check_snapshots(snapshot_dir: Path) -> int:
    failures = 0
    for name, url in TARGETS.items():
        expected_path = snapshot_dir / f"{name}.json"
        if not expected_path.exists():
            print(f"[check] missing snapshot: {expected_path}", file=sys.stderr)
            failures += 1
            continue

        actual = _normalize(_fetch_json(url))
        actual_text = _json_dumps(actual)
        expected_text = expected_path.read_text(encoding="utf-8")
        if actual_text != expected_text:
            print(f"[check] contract drift detected for {name}", file=sys.stderr)
            diff = difflib.unified_diff(
                expected_text.splitlines(),
                actual_text.splitlines(),
                fromfile=str(expected_path),
                tofile=f"{name} (live)",
                lineterm="",
            )
            for line in list(diff)[:300]:
                print(line, file=sys.stderr)
            failures += 1
        else:
            print(f"[check] {name}: OK")
    return 1 if failures else 0


def _pascal_case(value: str) -> str:
    parts = re.split(r"[^A-Za-z0-9]+", value)
    return "".join(p[:1].upper() + p[1:] for p in parts if p) or "Api"


def _derive_operation_id(method: str, path: str) -> str:
    cleaned = re.sub(r"[{}]", "", path.strip("/"))
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", cleaned)
    cleaned = cleaned.strip("_") or "root"
    return f"{method.lower()}_{cleaned}"


def _collect_operations(spec: dict[str, Any]) -> list[dict[str, Any]]:
    operations: list[dict[str, Any]] = []
    paths = spec.get("paths", {}) or {}
    for path, path_item in sorted(paths.items()):
        if not isinstance(path_item, dict):
            continue
        path_level_params = path_item.get("parameters", []) or []
        for method in HTTP_METHODS:
            op = path_item.get(method)
            if not isinstance(op, dict):
                continue
            op_id = op.get("operationId") or _derive_operation_id(method, path)
            tags = [str(t) for t in (op.get("tags") or [])]
            summary = str(op.get("summary") or op.get("description") or "").strip()
            combined_params = []
            combined_params.extend(path_level_params if isinstance(path_level_params, list) else [])
            combined_params.extend(op.get("parameters", []) if isinstance(op.get("parameters"), list) else [])
            path_params = sorted({m for m in PATH_PARAM_RE.findall(path)})
            query_params: list[str] = []
            for p in combined_params:
                if isinstance(p, dict) and p.get("in") == "query" and p.get("name"):
                    query_params.append(str(p["name"]))
            responses = op.get("responses", {}) or {}
            response_statuses = sorted([str(k) for k in responses.keys()])
            has_request_body = isinstance(op.get("requestBody"), dict)
            operations.append(
                {
                    "id": op_id,
                    "method": method.upper(),
                    "path": path,
                    "summary": summary,
                    "tags": tags,
                    "pathParams": path_params,
                    "queryParams": sorted(set(query_params)),
                    "hasRequestBody": has_request_body,
                    "responseStatuses": response_statuses,
                }
            )
    return sorted(operations, key=lambda x: (x["path"], x["method"], x["id"]))


def _ts_literal_array(items: list[str]) -> str:
    if not items:
        return "[] as const"
    joined = ", ".join(json.dumps(i) for i in items)
    return f"[{joined}] as const"


def _render_ts_common() -> str:
    return """/* eslint-disable */
// Generated by scripts/contracts/openapi_contracts.py
// Shared types used by all generated API clients.

export type RequestQueryValue = string | number | boolean | null | undefined;
export type RequestQuery = Record<string, RequestQueryValue | RequestQueryValue[]>;

export interface OperationRequestOptions {
  pathParams?: Record<string, string | number>;
  query?: RequestQuery;
  body?: unknown;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

export class ContractApiError extends Error {
  constructor(
    message: string,
    public readonly operationId: string,
    public readonly method: string,
    public readonly path: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "ContractApiError";
  }

  get status(): number {
    return this.statusCode;
  }
}
"""


def _render_ts_versions(manifest: dict[str, Any]) -> str:
    revisions = {
        service_name: service["snapshotRevision"]
        for service_name, service in sorted(manifest["services"].items())
    }
    upstream_versions = {
        service_name: service["upstreamVersion"]
        for service_name, service in sorted(manifest["services"].items())
    }
    manifest_literal = _json_dumps(manifest).rstrip()
    revisions_literal = _json_dumps(revisions).rstrip()
    upstream_versions_literal = _json_dumps(upstream_versions).rstrip()

    return f"""/* eslint-disable */
// Generated by scripts/contracts/openapi_contracts.py from contracts/openapi/manifest.json

export const CONTRACT_SNAPSHOT_MANIFEST = {manifest_literal} as const;

export type ContractManifest = typeof CONTRACT_SNAPSHOT_MANIFEST;
export type ContractServiceName = keyof ContractManifest["services"];
export type ContractServiceManifest = ContractManifest["services"][ContractServiceName];

export const CONTRACT_SNAPSHOT_REVISIONS = {revisions_literal} as const;
export const CONTRACT_UPSTREAM_VERSIONS = {upstream_versions_literal} as const;
"""


def _render_ts_client(service_name: str, spec: dict[str, Any]) -> str:
    pascal = _pascal_case(service_name)
    const_name = f"{service_name.upper()}_OPERATIONS"
    ops = _collect_operations(spec)
    info = spec.get("info", {}) if isinstance(spec.get("info"), dict) else {}
    title = str(info.get("title") or f"{pascal} API")
    version = str(info.get("version") or "")

    op_lines = []
    for op in ops:
        op_lines.append(
            "  {\n"
            f"    id: {json.dumps(op['id'])},\n"
            f"    method: {json.dumps(op['method'])},\n"
            f"    path: {json.dumps(op['path'])},\n"
            f"    summary: {json.dumps(op['summary'])},\n"
            f"    tags: {_ts_literal_array(op['tags'])},\n"
            f"    pathParams: {_ts_literal_array(op['pathParams'])},\n"
            f"    queryParams: {_ts_literal_array(op['queryParams'])},\n"
            f"    hasRequestBody: {'true' if op['hasRequestBody'] else 'false'},\n"
            f"    responseStatuses: {_ts_literal_array(op['responseStatuses'])},\n"
            "  },"
        )

    return f"""/* eslint-disable */
// Generated by scripts/contracts/openapi_contracts.py from contracts/openapi/{service_name}.json
// Source API: {title} {version}

import {{ ContractApiError, type RequestQuery, type OperationRequestOptions }} from './common';

export const {const_name} = [
{chr(10).join(op_lines)}
] as const;

export type {pascal}Operation = typeof {const_name}[number];
export type {pascal}OperationId = {pascal}Operation["id"];
export type {pascal}OperationMethod = {pascal}Operation["method"];
export type {pascal}OperationPath = {pascal}Operation["path"];

export const {service_name}OperationById: Record<{pascal}OperationId, {pascal}Operation> =
  Object.fromEntries({const_name}.map((op) => [op.id, op])) as Record<{pascal}OperationId, {pascal}Operation>;

export interface {pascal}ClientConfig {{
  baseUrl: string;
  defaultHeaders?: HeadersInit;
  defaultCredentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
}}

function buildUrl(pathTemplate: string, baseUrl: string, pathParams: Record<string, string | number> = {{}}, query?: RequestQuery) {{
  const substituted = pathTemplate.replace(/{{([^}}/]+)}}/g, (_, key: string) => {{
    const value = pathParams[key];
    if (value === undefined || value === null) {{
      throw new Error(`Missing path param: ${{key}}`);
    }}
    return encodeURIComponent(String(value));
  }});

  const normalizedPath = substituted.replace(/^\\/+/, "");
  const url = new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${{baseUrl}}/`);
  if (query) {{
    for (const [key, raw] of Object.entries(query)) {{
      if (raw === undefined || raw === null) continue;
      if (Array.isArray(raw)) {{
        for (const value of raw) {{
          if (value === undefined || value === null) continue;
          url.searchParams.append(key, String(value));
        }}
      }} else {{
        url.searchParams.set(key, String(raw));
      }}
    }}
  }}
  return url.toString();
}}

export class {pascal}ApiClient {{
  private readonly baseUrl: string;
  private readonly defaultHeaders?: HeadersInit;
  private readonly defaultCredentials?: RequestCredentials;
  private readonly fetchImpl: typeof fetch;

  constructor(config: {pascal}ClientConfig) {{
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = config.defaultHeaders;
    this.defaultCredentials = config.defaultCredentials;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }}

  async request<T = unknown>(operationId: {pascal}OperationId, options: OperationRequestOptions = {{}}): Promise<T> {{
    const op = {service_name}OperationById[operationId];
    const url = buildUrl(op.path, this.baseUrl, options.pathParams, options.query);
    const headers = new Headers(this.defaultHeaders);
    if (options.headers) {{
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    }}
    let body: BodyInit | undefined;
    if (options.body !== undefined) {{
      if (!headers.has("Content-Type")) {{
        headers.set("Content-Type", "application/json");
      }}
      body = headers.get("Content-Type")?.includes("application/json")
        ? JSON.stringify(options.body)
        : (options.body as BodyInit);
    }}

    const response = await this.fetchImpl(url, {{
      method: op.method,
      headers,
      body,
      credentials: options.credentials ?? this.defaultCredentials,
      signal: options.signal,
    }});

    if (!response.ok) {{
      const text = await response.text().catch(() => "");
      throw new ContractApiError(
        `API request failed (${{op.method}} ${{op.path}}): ${{response.status}} ${{text}}`,
        op.id,
        op.method,
        op.path,
        response.status,
        text
      );
    }}

    if (response.status === 204) {{
      return undefined as T;
    }}

    const text = await response.text().catch(() => "");
    if (!text) {{
      return undefined as T;
    }}

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {{
      return text as T;
    }}

    return JSON.parse(text) as T;
  }}
}}
"""


def generate_ts_clients(snapshot_dir: Path, out_dir: Path, check: bool, manifest_path: Path) -> int:
    manifest, manifest_failures = validate_contract_manifest(snapshot_dir, manifest_path)
    if manifest is None:
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    failures = manifest_failures
    generated_files: list[str] = []

    # Write (or check) the shared types module first.
    common_content = _render_ts_common()
    common_path = out_dir / "common.ts"
    if check:
        current = common_path.read_text(encoding="utf-8") if common_path.exists() else None
        if current != common_content:
            print(f"[ts-check] generated client drift: {common_path}", file=sys.stderr)
            failures += 1
        else:
            print("[ts-check] common.ts: OK")
    else:
        common_path.write_text(common_content, encoding="utf-8")
        print(f"[ts-gen] wrote {common_path}")

    versions_content = _render_ts_versions(manifest)
    versions_path = out_dir / "versions.ts"
    generated_files.append(versions_path.name)
    if check:
        current = versions_path.read_text(encoding="utf-8") if versions_path.exists() else None
        if current != versions_content:
            print(f"[ts-check] generated client drift: {versions_path}", file=sys.stderr)
            failures += 1
        else:
            print("[ts-check] versions.ts: OK")
    else:
        versions_path.write_text(versions_content, encoding="utf-8")
        print(f"[ts-gen] wrote {versions_path}")

    for snapshot_path in _iter_snapshot_paths(snapshot_dir, manifest_path):
        service_name = snapshot_path.stem
        spec = json.loads(snapshot_path.read_text(encoding="utf-8"))
        ts_content = _render_ts_client(service_name, spec)
        out_path = out_dir / f"{service_name}.ts"
        generated_files.append(out_path.name)
        if check:
            current = out_path.read_text(encoding="utf-8") if out_path.exists() else None
            if current != ts_content:
                print(f"[ts-check] generated client drift: {out_path}", file=sys.stderr)
                if current is not None:
                    diff = difflib.unified_diff(
                        current.splitlines(),
                        ts_content.splitlines(),
                        fromfile=str(out_path),
                        tofile=f"{out_path} (generated)",
                        lineterm="",
                    )
                    for line in list(diff)[:300]:
                        print(line, file=sys.stderr)
                failures += 1
            else:
                print(f"[ts-check] {out_path.name}: OK")
        else:
            out_path.write_text(ts_content, encoding="utf-8")
            print(f"[ts-gen] wrote {out_path}")

    barrel_lines = ["export * from './common';"]
    barrel_lines.extend(
        f"export * from './{Path(name).stem}';" for name in sorted(generated_files)
    )
    index_content = "\n".join(barrel_lines) + "\n"
    index_path = out_dir / "index.ts"
    if check:
        current = index_path.read_text(encoding="utf-8") if index_path.exists() else None
        if current != index_content:
            print(f"[ts-check] generated client drift: {index_path}", file=sys.stderr)
            failures += 1
        else:
            print("[ts-check] index.ts: OK")
    else:
        index_path.write_text(index_content, encoding="utf-8")
        print(f"[ts-gen] wrote {index_path}")

    return 1 if failures else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenAPI contract governance utilities")
    sub = parser.add_subparsers(dest="command", required=True)

    export_parser = sub.add_parser("export", help="Fetch and write normalized OpenAPI snapshots")
    export_parser.add_argument("--snapshot-dir", type=Path, default=DEFAULT_SNAPSHOT_DIR)

    check_parser = sub.add_parser("check", help="Check live OpenAPI docs against snapshots")
    check_parser.add_argument("--snapshot-dir", type=Path, default=DEFAULT_SNAPSHOT_DIR)
    check_parser.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST_PATH)
    check_parser.add_argument("--check-generated", action="store_true", help="Also validate generated TS clients")
    check_parser.add_argument("--ts-out-dir", type=Path, default=DEFAULT_TS_OUT_DIR)

    gen_parser = sub.add_parser("generate-ts", help="Generate typed TS operation clients from snapshots")
    gen_parser.add_argument("--snapshot-dir", type=Path, default=DEFAULT_SNAPSHOT_DIR)
    gen_parser.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST_PATH)
    gen_parser.add_argument("--ts-out-dir", type=Path, default=DEFAULT_TS_OUT_DIR)
    gen_parser.add_argument("--check", action="store_true", help="Check generated files are up to date")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "export":
        return export_snapshots(args.snapshot_dir)
    if args.command == "check":
        rc = check_snapshots(args.snapshot_dir)
        if args.check_generated:
            rc = rc or generate_ts_clients(
                args.snapshot_dir,
                args.ts_out_dir,
                check=True,
                manifest_path=args.manifest_path,
            )
        else:
            manifest_failures = validate_contract_manifest(args.snapshot_dir, args.manifest_path)[1]
            rc = rc or (1 if manifest_failures else 0)
        return rc
    if args.command == "generate-ts":
        return generate_ts_clients(
            args.snapshot_dir,
            args.ts_out_dir,
            check=args.check,
            manifest_path=args.manifest_path,
        )
    print(f"Unknown command: {args.command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
