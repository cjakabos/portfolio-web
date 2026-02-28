import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
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

describe("cloudapp hooks", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    window.localStorage.clear();
    document.cookie = "XSRF-TOKEN=test-xsrf; path=/";
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    mock.restore();
    jest.restoreAllMocks();
  });

  test("useAuth derives username and roles from auth-check", async () => {
    mock.onGet(`${API_URL}/user/auth-check`).reply(200, {
      username: "alice",
      roles: ["ROLE_USER", "ROLE_ADMIN"],
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(result.current.username).toBe("alice");
    expect(result.current.roles).toEqual(["ROLE_USER", "ROLE_ADMIN"]);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isReady).toBe(true);
  });

  test("useAuth clears state on unauthorized auth-check", async () => {
    mock.onGet(`${API_URL}/user/auth-check`).reply(401);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    expect(result.current.username).toBe("");
    expect(result.current.roles).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isReady).toBe(false);
  });

  test("useItems fetches items and creates new item", async () => {
    const { result } = renderHook(() => useItems());
    const first = [{ id: 1, name: "Item A", price: 5, description: "A" }];
    const second = [...first, { id: 2, name: "Item B", price: 7, description: "B" }];

    mock.onGet(`${API_URL}/item`).replyOnce(200, first);
    await act(async () => {
      await result.current.fetchItems();
    });
    expect(result.current.items).toEqual(first);

    mock.onPost(`${API_URL}/item`).reply(200, {});
    mock.onGet(`${API_URL}/item`).replyOnce(200, second);
    await act(async () => {
      await result.current.createItem("Item B", "7", "B");
    });
    expect(result.current.items).toEqual(second);
    const createRequest = mock.history.post.find((request) => request.url === `${API_URL}/item`);
    expect(createRequest?.headers?.Authorization).toBeUndefined();
    expect(createRequest?.headers?.["X-XSRF-TOKEN"]).toBe("test-xsrf");
  });

  test("useCart fetches and updates cart", async () => {
    const { result } = renderHook(() => useCart("alice"));
    const cartAfterAdd = { id: 1, items: [{ id: 11, name: "Widget", price: 9.99 }], total: 9.99 };
    const cleared = { id: 1, items: [], total: 0 };

    mock.onPost(`${API_URL}/cart/getCart`).reply(200, cartAfterAdd);
    await act(async () => {
      await result.current.fetchCart();
    });
    expect(result.current.cart.items).toHaveLength(1);
    expect(result.current.total).toBe(9.99);

    mock.onPost(`${API_URL}/cart/addToCart`).reply(200, {});
    mock.onPost(`${API_URL}/cart/getCart`).reply(200, cartAfterAdd);
    await act(async () => {
      await result.current.addToCart({ id: 11 });
    });
    expect(result.current.cart.items).toHaveLength(1);

    mock.onPost(`${API_URL}/cart/clearCart`).reply(200, cleared);
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

    mock.onGet(`${API_URL}/note/user/alice`).replyOnce(200, initial);
    await act(async () => {
      await result.current.fetchNotes();
    });
    expect(result.current.notes).toEqual(initial);

    mock.onPost(`${API_URL}/note/addNote`).reply(200, {});
    mock.onGet(`${API_URL}/note/user/alice`).replyOnce(200, initial);
    await act(async () => {
      await result.current.addNote("n1", "d1");
    });
    expect(result.current.notes).toEqual(initial);

    mock.onPost(`${API_URL}/note/updateNote`).reply(200, {});
    mock.onGet(`${API_URL}/note/user/alice`).replyOnce(200, updated);
    await act(async () => {
      await result.current.updateNote(1, "n1-u", "d1-u");
    });
    expect(result.current.notes).toEqual(updated);

    mock.onDelete(`${API_URL}/note/delete/1`).reply(200, {});
    mock.onGet(`${API_URL}/note/user/alice`).replyOnce(200, empty);
    await act(async () => {
      await result.current.deleteNote(1);
    });
    expect(result.current.notes).toEqual(empty);
  });

  test("useLogin posts credentials, keeps auth in cookies, and emits auth change", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    mock.onPost(`${API_URL}/user/user-login`).reply(200, { message: "Login successful" });
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ username: "alice", password: "secret" });
    });

    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")).toBeNull();
    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")).toBeNull();
    expect(mock.history.post[0]?.withCredentials).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    expect((dispatchSpy.mock.calls.at(-1)?.[0] as Event | undefined)?.type)
      .toBe(CLOUDAPP_AUTH_STATE_CHANGED_EVENT);
    expect(result.current.error).toBeNull();
  });

  test("useLogout calls logout endpoint with credentials and emits auth change", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    mock.onPost(`${API_URL}/user/user-logout`).reply(200, {});

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.logout();
    });

    const lastPost = mock.history.post[mock.history.post.length - 1];
    expect(lastPost?.withCredentials).toBe(true);
    expect(lastPost?.headers?.Authorization).toBeUndefined();
    expect(lastPost?.headers?.["X-XSRF-TOKEN"]).toBe("test-xsrf");
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

    mock.onPost(`${API_URL}/user/user-register`).reply(500, {});
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
