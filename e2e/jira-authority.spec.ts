import { test, expect, type APIRequestContext } from "@playwright/test";
import { JiraReadOnlyBoundary } from "./fixtures/jira-read-only";

const BASE = "http://fixture.test/jiraproxy/webDomain";
const QUERY = "/rest/api/latest/search/jql?jql=project=FIXTURE&maxResults=10";

test("read-only proxy dispatches an approved read without enabling mutations", async () => {
  const boundary = new JiraReadOnlyBoundary(BASE, "FIXTURE");
  const calls: unknown[] = [];
  const request = { post: async (...args: unknown[]) => {
    calls.push(args);
    return { ok: () => true, json: async () => ({ issues: [] }) };
  } } as unknown as APIRequestContext;
  expect(await boundary.read(request, QUERY, "synthetic-session")).toEqual({ issues: [] });
  expect(calls).toHaveLength(1);
  boundary.assertClean();
});

test("API input cannot expand the approved fixture project before dispatch", async () => {
  const boundary = new JiraReadOnlyBoundary(BASE, "FIXTURE");
  let calls = 0;
  const request = { post: async () => { calls++; throw new Error("must not dispatch"); } } as unknown as APIRequestContext;
  for (const path of ["/rest/api/latest/issue/FIXTURE-1", "/rest/api/latest/search/jql?jql=project=OTHER",
    "/rest/api/latest/search/jql?jql=project=FIXTURE&jql=project=OTHER"]) {
    await expect(boundary.read(request, path, "synthetic-session")).rejects.toThrow("Unapproved Jira operation");
  }
  expect(calls).toBe(0);
});

test("mutation endpoints and spoofed request bodies fail closed", () => {
  const boundary = new JiraReadOnlyBoundary(BASE, "FIXTURE");
  for (const operation of ["post", "put", "delete", "transition"]) {
    expect(() => boundary.assertAllowed(`${BASE}/${operation}`, "POST", { jiraPath: QUERY })).toThrow("Unapproved Jira operation");
  }
  expect(() => boundary.assertAllowed(`${BASE}/get`, "DELETE", { jiraPath: QUERY })).toThrow();
  expect(() => boundary.assertAllowed(`${BASE}/get`, "POST", { jiraPath: QUERY, method: "DELETE" })).toThrow();
  expect(() => boundary.assertAllowed(BASE.replace("fixture.test", "other.test") + "/get", "POST", { jiraPath: QUERY })).toThrow();
  expect(() => boundary.assertClean()).toThrow("unapproved operation");
});

test("metadata reads stay within the approved fixture project ID", async () => {
  const boundary = new JiraReadOnlyBoundary(BASE, "FIXTURE");
  expect(() => boundary.assertAllowed(`${BASE}/get`, "POST", {
    jiraPath: "/rest/api/latest/issuetype/project?projectId=10000",
  })).not.toThrow();
  let calls = 0;
  const request = { post: async () => { calls++; throw new Error("must not dispatch"); } } as unknown as APIRequestContext;
  for (const selector of ["999999", "10000&projectId=999999", "10000&projectId=10000", "", "010000"]) {
    await expect(boundary.read(request,
      `/rest/api/latest/issuetype/project?projectId=${selector}`, "synthetic-session")).rejects.toThrow("Unapproved Jira operation");
  }
  expect(calls).toBe(0);
});

test("configured proxy namespaces and path aliases cannot bypass browser routing", async ({ page }) => {
  const customBase = "http://fixture.test/custom/webDomain";
  const boundary = new JiraReadOnlyBoundary(customBase, "FIXTURE");
  const transported: string[] = [];
  await page.context().route("http://fixture.test/**", async route => {
    transported.push(route.request().url());
    await route.fulfill({ contentType: "application/json", body: '{"issues":[]}' });
  });
  await boundary.install(page.context());
  await page.goto("http://fixture.test/");
  const paths = ["/custom/webDomain/post", "/custom;alias/webDomain/delete", "/custom/webDomain;alias/put",
    "/custom%2fwebDomain/post", "/jiraproxy;alias/webDomain/post", "/v1/jiraproxy%3balias/webDomain/delete"];
  for (const path of paths) {
    await page.evaluate(async path => {
      await fetch(path, { method: "POST", body: '{}' }).catch(() => {});
    }, path);
  }
  expect(transported).toEqual(["http://fixture.test/"]);
  expect(boundary.blocked).toHaveLength(paths.length);
  expect(() => boundary.assertClean()).toThrow("6 unapproved operation");
});

test("browser boundary aborts mutations before the transport while allowing reads and preflight", async ({ page }) => {
  const boundary = new JiraReadOnlyBoundary(BASE, "FIXTURE");
  const transported: string[] = [];
  await page.context().route("http://fixture.test/**", async route => {
    transported.push(route.request().url());
    await route.fulfill({ contentType: "application/json", body: '{"issues":[]}' });
  });
  await boundary.install(page.context());
  await page.goto("http://fixture.test/");
  const read = await page.evaluate(async ({ base, query }) => (await fetch(base + "/get", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jiraPath: query }),
  })).status, { base: BASE, query: QUERY });
  expect(read).toBe(200);
  expect(() => boundary.assertAllowed(BASE + "/get", "OPTIONS", null)).not.toThrow();
  for (const operation of ["post", "put", "delete", "transition"]) {
    await page.evaluate(async ({ base, operation }) => {
      await fetch(base + "/" + operation, { method: "POST", body: '{}' }).catch(() => {});
    }, { base: BASE, operation });
  }
  expect(transported.filter(url => url.includes("/webDomain/"))).toEqual([BASE + "/get"]);
  expect(boundary.blocked).toHaveLength(4);
  expect(() => boundary.assertClean()).toThrow("4 unapproved operation");
});
