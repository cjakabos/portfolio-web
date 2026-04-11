import { act, renderHook, waitFor } from "@testing-library/react";
import { useAuth, CLOUDAPP_AUTH_STATE_CHANGED_EVENT } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useItems } from "../hooks/useItems";
import { useLogin } from "../hooks/useLogin";
import { useLogout } from "../hooks/useLogout";
import { useNotes } from "../hooks/useNotes";
import { useRegister } from "../hooks/useRegister";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    asPath: "/",
    pathname: "/",
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

const API_URL = "http://localhost:80/cloudapp";
const originalFetch = global.fetch;
const createFetchResponse = (body: string, status: number, contentType = "application/json") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (
        name.toLowerCase() === "content-type" ? contentType : null
      ),
    },
    text: async () => body,
  } as Response);

const normalizeUrl = (url: string) => new URL(url).toString();

describe("cloudapp hooks", () => {
  type FetchRoute = {
    method: string;
    url: string;
    status?: number;
    body?: unknown;
    contentType?: string;
  };

  let fetchRoutes: FetchRoute[];
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchRoutes = [];
    fetchMock = jest.fn(async () => {
      throw new Error("Unexpected fetch call");
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = normalizeUrl(typeof input === "string" ? input : input.toString());
      const method = (init?.method ?? "GET").toUpperCase();
      const routeIndex = fetchRoutes.findIndex(
        (route) => normalizeUrl(route.url) === url && route.method === method,
      );
      if (routeIndex < 0) {
        throw new Error(`Unexpected fetch call: ${method} ${url}`);
      }

      const route = fetchRoutes.splice(routeIndex, 1)[0];
      const status = route.status ?? 200;
      const contentType = route.contentType ?? "application/json";
      const body = typeof route.body === "string" ? route.body : JSON.stringify(route.body ?? {});

      return createFetchResponse(body, status, contentType);
    });
    global.fetch = fetchMock as typeof fetch;
    window.localStorage.clear();
    document.cookie = "XSRF-TOKEN=test-xsrf; path=/";
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mockFetchJson = (
    method: string,
    url: string,
    body: unknown,
    status = 200,
  ) => {
    fetchRoutes.push({ method: method.toUpperCase(), url, body, status });
  };

  const getRequestHeaders = (requestInit?: RequestInit) => {
    if (!requestInit?.headers) {
      return {};
    }

    return Object.fromEntries(new Headers(requestInit.headers).entries());
  };

  test("useAuth derives username and roles from auth-check", async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse(JSON.stringify({
        username: "alice",
        roles: ["ROLE_USER", "ROLE_ADMIN"],
      }), 200),
    );

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(result.current.username).toBe("alice");
    expect(result.current.roles).toEqual(["ROLE_USER", "ROLE_ADMIN"]);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isReady).toBe(true);
  });

  test("useAuth clears state on unauthorized auth-check", async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse("Unauthorized", 401, "text/plain"),
    );

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(result.current.username).toBe("");
    expect(result.current.roles).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isReady).toBe(false);
  });

  test("useAuth resolves root-relative API URLs against the current origin", async () => {
    const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "/cloudapp";

    fetchMock.mockResolvedValueOnce(
      createFetchResponse(JSON.stringify({
        username: "alice",
        roles: ["ROLE_USER"],
      }), 200),
    );

    try {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isInitialized).toBe(true));
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
      }
    }

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/cloudapp/user/auth-check`,
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
  });

  test("useItems fetches items and creates new item", async () => {
    const { result } = renderHook(() => useItems());
    const first = [{ id: 1, name: "Item A", price: 5, description: "A" }];
    const second = [...first, { id: 2, name: "Item B", price: 7, description: "B" }];

    mockFetchJson("GET", `${API_URL}/item`, first);
    await act(async () => {
      await result.current.fetchItems();
    });
    expect(result.current.items).toEqual(first);

    mockFetchJson("POST", `${API_URL}/item`, {});
    mockFetchJson("GET", `${API_URL}/item`, second);
    await act(async () => {
      await result.current.createItem("Item B", "7", "B");
    });
    expect(result.current.items).toEqual(second);
    const createRequest = fetchMock.mock.calls.find(
      ([url, init]) => normalizeUrl(url as string) === normalizeUrl(`${API_URL}/item`) && init?.method === "POST",
    );
    const createHeaders = getRequestHeaders(createRequest?.[1]);
    expect(createHeaders.authorization).toBeUndefined();
    expect(createHeaders["x-xsrf-token"]).toBe("test-xsrf");
  });

  test("useCart fetches and updates cart", async () => {
    const { result } = renderHook(() => useCart("alice"));
    const cartAfterAdd = { id: 1, items: [{ id: 11, name: "Widget", price: 9.99 }], total: 9.99 };
    const cleared = { id: 1, items: [], total: 0 };

    mockFetchJson("POST", `${API_URL}/cart/getCart`, cartAfterAdd);
    await act(async () => {
      await result.current.fetchCart();
    });
    expect(result.current.cart.items).toHaveLength(1);
    expect(result.current.total).toBe(9.99);

    mockFetchJson("POST", `${API_URL}/cart/addToCart`, {});
    mockFetchJson("POST", `${API_URL}/cart/getCart`, cartAfterAdd);
    await act(async () => {
      await result.current.addToCart({ id: 11 });
    });
    expect(result.current.cart.items).toHaveLength(1);

    mockFetchJson("POST", `${API_URL}/cart/clearCart`, cleared);
    await act(async () => {
      await result.current.clearCart();
    });
    expect(result.current.cart.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  test("useNotes add/update/delete refreshes notes", async () => {
    const { result } = renderHook(() => useNotes("alice"));
    const initial = [{ id: 1, title: "n1", description: "d1" }];
    const updated = [{ id: 1, title: "n1-u", description: "d1-u" }];
    const empty: any[] = [];

    mockFetchJson("GET", `${API_URL}/note/user/alice`, initial);
    await act(async () => {
      await result.current.fetchNotes();
    });
    expect(result.current.notes).toEqual(initial);

    mockFetchJson("POST", `${API_URL}/note/addNote`, {});
    mockFetchJson("GET", `${API_URL}/note/user/alice`, initial);
    await act(async () => {
      await result.current.addNote("n1", "d1");
    });
    expect(result.current.notes).toEqual(initial);

    mockFetchJson("POST", `${API_URL}/note/updateNote`, {});
    mockFetchJson("GET", `${API_URL}/note/user/alice`, updated);
    await act(async () => {
      await result.current.updateNote(1, "n1-u", "d1-u");
    });
    expect(result.current.notes).toEqual(updated);

    mockFetchJson("DELETE", `${API_URL}/note/delete/1`, {});
    mockFetchJson("GET", `${API_URL}/note/user/alice`, empty);
    await act(async () => {
      await result.current.deleteNote(1);
    });
    expect(result.current.notes).toEqual(empty);
  });

  test("useLogin posts credentials, keeps auth in cookies, and emits auth change", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    mockFetchJson("POST", `${API_URL}/user/user-login`, { message: "Login successful" });
    mockFetchJson("GET", `${API_URL}/user/auth-check`, {
      username: "alice",
      roles: ["ROLE_USER"],
    });
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ username: "alice", password: "secret" });
    });

    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")).toBeNull();
    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")).toBeNull();
    const loginRequest = fetchMock.mock.calls.find(
      ([url, init]) => normalizeUrl(url as string) === normalizeUrl(`${API_URL}/user/user-login`) && init?.method === "POST",
    );
    expect(loginRequest?.[1]?.credentials).toBe("include");
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect((dispatchSpy.mock.calls.at(-1)?.[0] as Event | undefined)?.type)
      .toBe(CLOUDAPP_AUTH_STATE_CHANGED_EVENT);
    expect(result.current.error).toBeNull();
  });

  test("useLogout calls logout endpoint with credentials and emits auth change", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    mockFetchJson("POST", `${API_URL}/user/user-logout`, {});

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.logout();
    });

    const lastPost = fetchMock.mock.calls.find(
      ([url, init]) => normalizeUrl(url as string) === normalizeUrl(`${API_URL}/user/user-logout`) && init?.method === "POST",
    );
    const logoutHeaders = getRequestHeaders(lastPost?.[1]);
    expect(lastPost?.[1]?.credentials).toBe("include");
    expect(logoutHeaders.authorization).toBeUndefined();
    expect(logoutHeaders["x-xsrf-token"]).toBe("test-xsrf");
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect((dispatchSpy.mock.calls.at(-1)?.[0] as Event | undefined)?.type)
      .toBe(CLOUDAPP_AUTH_STATE_CHANGED_EVENT);
    expect(result.current.error).toBeNull();
  });

  test("useRegister validates password mismatch and API errors", async () => {
    const { result } = renderHook(() => useRegister());

    await act(async () => {
      await result.current.register({
        firstname: "A",
        lastname: "B",
        username: "alice",
        password: "one",
        confirmPassword: "two",
      });
    });
    expect(result.current.errorType).toBe("PASSWORD_MISMATCH");

    mockFetchJson("POST", `${API_URL}/user/user-register`, {}, 500);
    await act(async () => {
      await result.current.register({
        firstname: "A",
        lastname: "B",
        username: "alice",
        password: "same",
        confirmPassword: "same",
      });
    });
    expect(result.current.errorType).toBe("API_ERROR");
  });
});
