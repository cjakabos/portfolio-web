import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import CloudProfile from "../pages/profile";
import { useAuth } from "../hooks/useAuth";
import { getCloudAppCsrfHeaders } from "../hooks/cloudappCsrf";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    asPath: "/profile",
    pathname: "/profile",
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

jest.mock("../hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../hooks/cloudappCsrf", () => ({
  getCloudAppCsrfHeaders: jest.fn(),
}));

const API_URL = "http://localhost:80/cloudapp";
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedGetCloudAppCsrfHeaders =
  getCloudAppCsrfHeaders as jest.MockedFunction<typeof getCloudAppCsrfHeaders>;

describe("CloudProfile page", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    mockedUseAuth.mockReturnValue({
      username: "",
      roles: [],
      isAdmin: false,
      isReady: false,
      isInitialized: true,
      isChecking: false,
      refreshAuthState: jest.fn(),
    });
    mockedGetCloudAppCsrfHeaders.mockResolvedValue({
      "X-XSRF-TOKEN": "test-xsrf",
    });
    window.localStorage.clear();
    document.cookie = "XSRF-TOKEN=test-xsrf; path=/";
  });

  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    mock.restore();
    jest.restoreAllMocks();
  });

  test("shows role from auth-check and keeps username/email disabled", async () => {
    mockedUseAuth.mockReturnValue({
      username: "alice",
      roles: ["ROLE_USER", "ROLE_ADMIN"],
      isAdmin: true,
      isReady: true,
      isInitialized: true,
      isChecking: false,
      refreshAuthState: jest.fn(),
    });

    render(React.createElement(CloudProfile));

    const usernameInput = (await screen.findByLabelText("Username")) as HTMLInputElement;
    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;

    await waitFor(() => expect(usernameInput.value).toBe("alice"));

    expect(usernameInput).toBeDisabled();
    expect(emailInput.value).toBe("alice@example.com");
    expect(emailInput).toBeDisabled();
    expect(screen.getAllByText("User, Admin").length).toBeGreaterThan(0);

    expect(screen.getByLabelText("Current Password")).toBeEnabled();
    expect(screen.getByLabelText("New Password")).toBeEnabled();
    expect(screen.getByLabelText("Confirm New Password")).toBeEnabled();
  });

  test("submits password change with current password and csrf header", async () => {
    mockedUseAuth.mockReturnValue({
      username: "alice",
      roles: ["ROLE_USER"],
      isAdmin: false,
      isReady: true,
      isInitialized: true,
      isChecking: false,
      refreshAuthState: jest.fn(),
    });
    mock.onPost(`${API_URL}/user/user-change-password`).reply(200, {
      username: "alice",
      message: "Password updated",
    });

    render(React.createElement(CloudProfile));

    await waitFor(() =>
      expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("alice")
    );

    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "securePass123" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "securePass456" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "securePass456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await screen.findByText("Password updated successfully.");

    const [request] = mock.history.post;
    expect(request?.withCredentials).toBe(true);
    expect(request?.headers?.Authorization).toBeUndefined();
    expect(request?.headers?.["X-XSRF-TOKEN"]).toBe("test-xsrf");
    expect(JSON.parse(request?.data || "{}")).toEqual({
      currentPassword: "securePass123",
      newPassword: "securePass456",
      confirmNewPassword: "securePass456",
    });
  });
});
