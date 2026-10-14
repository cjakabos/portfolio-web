import type { APIRequestContext, BrowserContext } from "@playwright/test";

function proxyNamespace(pathname: string): string {
  // Classify encoded and matrix-parameter aliases as proxy traffic too. Only
  // the original, exact /get URL is allowed by the separate request check.
  let path = pathname;
  for (let i = 0; i < 4; i++) {
    const decoded = decodeURIComponent(path);
    if (decoded === path) return path.replace(/\\/g, "/").replace(/;[^/]*/g, "").replace(/\/{2,}/g, "/");
    path = decoded;
  }
  throw new Error("Ambiguous proxy path encoding");
}

/** Unattended Jira tests may read a fixture project, never approve mutations. */
export class JiraReadOnlyBoundary {
  readonly blocked: string[] = [];
  private readonly base: URL;

  constructor(proxyBase: string, private readonly project: string) {
    this.base = new URL(proxyBase.replace(/\/$/, ""));
    if (!/^https?:$/.test(this.base.protocol) || this.base.username || this.base.password || this.base.search || this.base.hash
        || proxyNamespace(this.base.pathname) !== this.base.pathname
        || !/^[A-Z][A-Z0-9_]*$/.test(project)) {
      throw new Error("Invalid read-only Jira target");
    }
  }

  private isProxy(url: URL): boolean {
    try {
      const path = proxyNamespace(url.pathname);
      return path === this.base.pathname || path.startsWith(`${this.base.pathname}/`)
        || /\/(?:v1\/)?jiraproxy(?:\/|$)/.test(path);
    } catch {
      return true;
    }
  }

  private allowed(url: URL, method: string, payload: unknown): boolean {
    if (url.origin !== this.base.origin || url.pathname !== `${this.base.pathname}/get` || url.search || url.hash) return false;
    if (method === "OPTIONS") return true; // Browser CORS negotiation has no Jira operation.
    if (method !== "POST") return false;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const data = payload as Record<string, unknown>;
    if (Object.keys(data).length !== 1 || typeof data.jiraPath !== "string" || !data.jiraPath.startsWith("/rest/api/")) return false;
    const target = new URL(data.jiraPath, "https://fixture.invalid");
    if (target.origin !== "https://fixture.invalid") return false;
    if (/^\/rest\/api\/(?:latest|2|3)\/search\/jql$/.test(target.pathname)) {
      return target.searchParams.getAll("jql").length === 1
        && target.searchParams.get("jql") === `project=${this.project}`;
    }
    // The existing board uses project ID 10000. The approved fixture project
    // must have that ID; metadata for another project needs a separate task.
    return /^\/rest\/api\/(?:latest|2|3)\/issuetype\/project$/.test(target.pathname)
      && target.searchParams.getAll("projectId").length === 1
      && target.searchParams.get("projectId") === "10000";
  }

  assertAllowed(url: string, method: string, payload: unknown): void {
    const target = new URL(url);
    let permitted = false;
    try { permitted = this.allowed(target, method, payload); } catch { /* Malformed input fails closed. */ }
    if (!permitted) {
      const operation = `${method} ${target.pathname}`;
      this.blocked.push(operation);
      throw new Error(`Unapproved Jira operation blocked: ${operation}`);
    }
  }

  async install(context: BrowserContext): Promise<void> {
    // The caller disables service workers; otherwise routing can be bypassed.
    await context.route("**/*", async route => {
      const request = route.request();
      if (!this.isProxy(new URL(request.url()))) return route.fallback();
      let payload: unknown;
      try { payload = request.postDataJSON(); } catch { payload = null; }
      try {
        this.assertAllowed(request.url(), request.method(), payload);
      } catch {
        await route.abort("blockedbyclient");
        return;
      }
      await route.fallback();
    });
  }

  async read(request: APIRequestContext, jiraPath: string, token: string): Promise<Record<string, unknown>> {
    const url = `${this.base.href}/get`;
    const payload = { jiraPath };
    // APIRequestContext is separate from browser routing: verify before dispatch.
    this.assertAllowed(url, "POST", payload);
    const response = await request.post(url, {
      data: payload, headers: { Authorization: token }, maxRedirects: 0,
    });
    if (!response.ok()) throw new Error(`Read-only Jira check failed (HTTP ${response.status()})`);
    return await response.json() as Record<string, unknown>;
  }

  assertClean(): void {
    if (this.blocked.length) throw new Error(`Read-only Jira test attempted ${this.blocked.length} unapproved operation(s)`);
  }
}
