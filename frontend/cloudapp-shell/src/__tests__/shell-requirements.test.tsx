import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Layout from "../components/Layout";
import Home from "../pages/index";
import RemoteModuleRoute from "../components/RemoteModuleRoute";
import { buildInitialRemoteModuleStatus } from "../lib/remoteModules";

const mockRefresh = jest.fn();
let mockAdmin = false;
let mockStatus = buildInitialRemoteModuleStatus({
  NEXT_PUBLIC_ENABLE_OPENMAPS: "true", NEXT_PUBLIC_ENABLE_CHATLLM: "true",
  NEXT_PUBLIC_ENABLE_JIRA: "true", NEXT_PUBLIC_ENABLE_MLOPS: "true", NEXT_PUBLIC_ENABLE_PETSTORE: "true",
});
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({
  username: "reader", isAdmin: mockAdmin, isReady: true, isInitialized: true, isChecking: false,
}) }));
jest.mock("../hooks/useLogout", () => ({ useLogout: () => ({ logout: jest.fn() }) }));
jest.mock("../context/RemoteModulesContext", () => ({ useRemoteModules: () => ({
  remoteStatus: mockStatus, hasLoaded: true, refresh: mockRefresh,
}) }));
jest.mock("next/router", () => ({ useRouter: () => ({ pathname: "/" }) }));
jest.mock("next/image", () => ({ __esModule: true, default: (props: any) => <img {...props} /> }));

beforeEach(() => {
  mockAdmin = false;
  for (const status of Object.values(mockStatus)) {
    status.enabled = true;
    status.available = true;
  }
});

test("Rendered navigation and dashboard apply role and loaded remote availability", () => {
  mockStatus.openmaps.available = false;
  mockStatus.chatllm.enabled = false;
  const { container, rerender } = render(<Layout><Home /></Layout>);
  for (const path of ["/maps", "/chatllm", "/jira", "/mlops", "/petstore"]) {
    expect(container.querySelector(`a[href='${path}']`)).toBeNull();
  }
  for (const path of ["/files", "/shop", "/chat"]) {
    expect(container.querySelectorAll(`a[href='${path}']`).length).toBeGreaterThanOrEqual(2);
  }
  mockStatus.openmaps.available = true;
  mockStatus.chatllm.enabled = true;
  rerender(<Layout><Home /></Layout>);
  expect(container.querySelectorAll("a[href='/maps']").length).toBeGreaterThanOrEqual(2);
  expect(container.querySelectorAll("a[href='/chatllm']").length).toBeGreaterThanOrEqual(2);
});

test("Rendered administrator modules appear only for administrators", () => {
  const { container, rerender } = render(<Layout><Home /></Layout>);
  for (const path of ["/jira", "/mlops", "/petstore"]) expect(container.querySelector(`a[href='${path}']`)).toBeNull();
  mockAdmin = true;
  rerender(<Layout><Home /></Layout>);
  for (const path of ["/jira", "/mlops", "/petstore"]) expect(container.querySelectorAll(`a[href='${path}']`).length).toBeGreaterThanOrEqual(2);
});

test("Disabled remote explains opt-in profile and expected public URL", () => {
  mockStatus.chatllm.enabled = false;
  render(<RemoteModuleRoute remoteKey="chatllm"><span>Remote content</span></RemoteModuleRoute>);
  expect(screen.getByRole("heading", { name: /Is Opt-In/ })).toBeInTheDocument();
  expect(screen.getByText(/Start the .* showcase profile/)).toBeInTheDocument();
  expect(screen.getByText(`Expected public URL: ${mockStatus.chatllm.publicUrl}`)).toBeInTheDocument();
  expect(screen.queryByText("Remote content")).toBeNull();
  expect(screen.getByRole("link", { name: "Back to Dashboard" })).toHaveAttribute("href", "/");
});

test("Unreachable remote explains recovery and retries the availability check", () => {
  mockStatus.openmaps.available = false;
  render(<RemoteModuleRoute remoteKey="openmaps"><span>Remote content</span></RemoteModuleRoute>);
  expect(screen.getByRole("heading", { name: /Is Not Reachable/ })).toBeInTheDocument();
  expect(screen.getByText(/not running or has not finished booting/)).toBeInTheDocument();
  expect(screen.getByText(`Expected public URL: ${mockStatus.openmaps.publicUrl}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry Check" }));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Remote content")).toBeNull();
});
