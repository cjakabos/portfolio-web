import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useItems } from "../hooks/useItems";
import { useLogin } from "../hooks/useLogin";
import { useLogout } from "../hooks/useLogout";
import { useNotes } from "../hooks/useNotes";
import { useRegister } from "../hooks/useRegister";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const API_URL = "http://localhost:80/cloudapp";

describe("cloudapp hooks", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    window.localStorage.clear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  test("useAuth reads token and username from localStorage", async () => {
    window.localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", "jwt-token");
    window.localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", "alice");

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.username).toBe("alice"));

    expect(result.current.token).toBe("Bearer jwt-token");
    expect(result.current.isReady).toBe(true);
  });

  test("useAuth does not double-prefix legacy Bearer tokens from localStorage", async () => {
    window.localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", "Bearer legacy-token");
    window.localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", "alice");

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.username).toBe("alice"));

    expect(result.current.token).toBe("Bearer legacy-token");
    expect(result.current.isReady).toBe(true);
  });

  test("useItems fetches items and creates new item", async () => {
    const { result } = renderHook(() => useItems("Bearer token"));
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
  });

  test("useCart fetches and updates cart", async () => {
    const { result } = renderHook(() => useCart("alice", "Bearer token"));
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
    const { result } = renderHook(() => useNotes("alice", "Bearer token"));
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

  test("useLogin stores JWT and username in localStorage", async () => {
    mock.onPost(`${API_URL}/user/user-login`).reply(200, {}, { authorization: "Bearer abc123" });
    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login({ username: "alice", password: "secret" });
    });

    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")).toBe("alice");
    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")).toBe("abc123");
    expect(mock.history.post[0]?.withCredentials).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test("useLogin and useAuth roundtrip keeps a single Bearer prefix", async () => {
    mock.onPost(`${API_URL}/user/user-login`).reply(200, {}, { authorization: "Bearer abc123" });
    const { result: loginResult } = renderHook(() => useLogin());

    await act(async () => {
      await loginResult.current.login({ username: "alice", password: "secret" });
    });

    const { result: authResult } = renderHook(() => useAuth());
    await waitFor(() => expect(authResult.current.username).toBe("alice"));

    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")).toBe("abc123");
    expect(authResult.current.token).toBe("Bearer abc123");
    expect(loginResult.current.error).toBeNull();
  });

  test("useLogout clears local auth state and calls logout endpoint with credentials", async () => {
    window.localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", "alice");
    window.localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", "abc123");
    mock.onPost(`${API_URL}/user/user-logout`).reply(200, {});

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.logout();
    });

    const lastPost = mock.history.post[mock.history.post.length - 1];
    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")).toBeNull();
    expect(window.localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")).toBeNull();
    expect(lastPost?.withCredentials).toBe(true);
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
