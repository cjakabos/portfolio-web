import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import CloudProfile from "../pages/profile";

const API_URL = "http://localhost:80/cloudapp";

const makeJwt = (roles: string[]) => {
  const payload = { sub: "alice", roles };
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `header.${payloadB64}.sig`;
};

describe("CloudProfile page", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    window.localStorage.clear();
  });

  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  test("shows role from JWT and keeps username/email disabled", async () => {
    window.localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", "alice");
    window.localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", makeJwt(["ROLE_USER", "ROLE_ADMIN"]));

    render(React.createElement(CloudProfile));

    const usernameInput = (await screen.findByLabelText("Username")) as HTMLInputElement;
    const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;

    expect(usernameInput.value).toBe("alice");
    expect(usernameInput).toBeDisabled();
    expect(emailInput.value).toBe("alice@example.com");
    expect(emailInput).toBeDisabled();
    expect(screen.getAllByText("User, Admin").length).toBeGreaterThan(0);

    expect(screen.getByLabelText("Current Password")).toBeEnabled();
    expect(screen.getByLabelText("New Password")).toBeEnabled();
    expect(screen.getByLabelText("Confirm New Password")).toBeEnabled();
  });

  test("submits password change with current password and auth header", async () => {
    const jwt = makeJwt(["ROLE_USER"]);
    window.localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", "alice");
    window.localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", jwt);
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
    expect(request?.headers?.Authorization).toBe(`Bearer ${jwt}`);
    expect(JSON.parse(request?.data || "{}")).toEqual({
      currentPassword: "securePass123",
      newPassword: "securePass456",
      confirmNewPassword: "securePass456",
    });
  });
});
