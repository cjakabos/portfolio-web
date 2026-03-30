import {
  allAuthedRoutes,
  getVisibleAuthedRoutes,
  getVisibleDashboardRoutes,
} from "../constants/routes";
import {
  buildInitialRemoteModuleStatus,
  type RemoteModuleStatusMap,
} from "../lib/remoteModules";

const buildRemoteStatus = (overrides: Partial<RemoteModuleStatusMap> = {}) => ({
  ...buildInitialRemoteModuleStatus({
    NEXT_PUBLIC_ENABLE_OPENMAPS: "true",
    NEXT_PUBLIC_ENABLE_CHATLLM: "true",
    NEXT_PUBLIC_ENABLE_JIRA: "true",
    NEXT_PUBLIC_ENABLE_MLOPS: "true",
    NEXT_PUBLIC_ENABLE_PETSTORE: "true",
  }),
  ...overrides,
});

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
      expect.arrayContaining(["/", "/files", "/shop", "/chat", "/maps", "/chatllm"])
    );
  });

  test("Route filtering logic works for Admin users", () => {
    const accessibleRoutes = getVisibleAuthedRoutes({
      isAdmin: true,
      remoteStatus: buildRemoteStatus(),
      remoteStatusLoaded: true,
    });
    expect(accessibleRoutes).toHaveLength(allAuthedRoutes.length);
  });

  test("Route filtering logic works for Non-Admin users", () => {
    const accessibleRoutes = getVisibleAuthedRoutes({
      isAdmin: false,
      remoteStatus: buildRemoteStatus(),
      remoteStatusLoaded: true,
    });
    const adminRoutes = allAuthedRoutes.filter((r) => r.adminOnly);

    expect(accessibleRoutes).toHaveLength(allAuthedRoutes.length - adminRoutes.length);
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/jira");
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/mlops");
    expect(accessibleRoutes.map((r) => r.path)).not.toContain("/petstore");
  });

  test("Unavailable optional remotes are hidden from the shell navigation", () => {
    const remoteStatus = buildRemoteStatus({
      chatllm: {
        ...buildRemoteStatus().chatllm,
        available: false,
      },
      jira: {
        ...buildRemoteStatus().jira,
        available: false,
      },
      mlops: {
        ...buildRemoteStatus().mlops,
        available: false,
      },
      petstore: {
        ...buildRemoteStatus().petstore,
        available: false,
      },
    });

    const visibleRoutes = getVisibleAuthedRoutes({
      isAdmin: true,
      remoteStatus,
      remoteStatusLoaded: true,
    });

    expect(visibleRoutes.map((route) => route.path)).not.toContain("/chatllm");
    expect(visibleRoutes.map((route) => route.path)).not.toContain("/jira");
    expect(visibleRoutes.map((route) => route.path)).not.toContain("/mlops");
    expect(visibleRoutes.map((route) => route.path)).not.toContain("/petstore");
  });

  test("OpenMaps remains visible while the initial availability check is still running", () => {
    const baseStatus = buildRemoteStatus();
    const visibleRoutes = getVisibleAuthedRoutes({
      isAdmin: false,
      remoteStatus: {
        ...baseStatus,
        openmaps: {
          ...baseStatus.openmaps,
          available: null,
        },
      },
      remoteStatusLoaded: false,
    });

    expect(visibleRoutes.map((route) => route.path)).toContain("/maps");
  });

  test("Dashboard cards follow the same remote visibility rules as navigation", () => {
    const baseStatus = buildRemoteStatus();
    const dashboardRoutes = getVisibleDashboardRoutes({
      isAdmin: false,
      remoteStatus: {
        ...baseStatus,
        chatllm: {
          ...baseStatus.chatllm,
          enabled: false,
          available: null,
        },
      },
      remoteStatusLoaded: true,
    });

    expect(dashboardRoutes.map((route) => route.path)).not.toContain("/");
    expect(dashboardRoutes.map((route) => route.path)).not.toContain("/chatllm");
    expect(dashboardRoutes.map((route) => route.path)).toContain("/maps");
  });
});
