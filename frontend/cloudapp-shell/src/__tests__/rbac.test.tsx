import { allAuthedRoutes } from "../constants/routes";

describe("RBAC Route Configuration", () => {
  test("Admin-only routes are correctly tagged", () => {
    const adminRoutes = allAuthedRoutes.filter((r) => r.adminOnly);
    const userRoutes = allAuthedRoutes.filter((r) => !r.adminOnly);

    // Verify specific admin routes
    expect(adminRoutes.map((r) => r.path)).toEqual(
      expect.arrayContaining(["/jira", "/mlops", "/petstore"])
    );

    // Verify specific user routes
    expect(userRoutes.map((r) => r.path)).toEqual(
      expect.arrayContaining(["/", "/notes", "/files", "/shop", "/chat", "/maps", "/chatllm"])
    );
  });

  test("Route filtering logic works for Admin users", () => {
    const isAdmin = true;
    const accessibleRoutes = allAuthedRoutes.filter((r) => !r.adminOnly || isAdmin);
    expect(accessibleRoutes).toHaveLength(allAuthedRoutes.length);
  });

  test("Route filtering logic works for Non-Admin users", () => {
    const isAdmin = false;
    const accessibleRoutes = allAuthedRoutes.filter((r) => !r.adminOnly || isAdmin);
    const adminRoutes = allAuthedRoutes.filter((r) => r.adminOnly);

    expect(accessibleRoutes).toHaveLength(allAuthedRoutes.length - adminRoutes.length);
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/jira");
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/mlops");
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/petstore");
  });
});
