import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Chat from "../pages/chat/index";
import CloudChat from "../pages/chat/rooms/[roomId]";

const mockRouter = { pathname: "/chat", query: { roomId: "ROOM-42" }, push: jest.fn(), replace: jest.fn() };
const mockRequestJson = jest.fn();
let mockConnected: () => void;
let mockError: (error: any) => void;
const mockSubscriptions: Record<string, (value: any) => void> = {};
const mockSocket = { connected: false, debug: jest.fn(), disconnect: jest.fn(), send: jest.fn(),
  connect: jest.fn((_headers, connected, error) => { mockConnected = connected; mockError = error; }),
  subscribe: jest.fn((topic, callback) => { mockSubscriptions[topic] = callback; }),
};
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("../hooks/useAuth", () => ({ useAuth: () => ({ username: "alice" }) }));
jest.mock("../hooks/cloudappClient", () => ({ getCloudAppSessionClient: () => ({ requestJson: mockRequestJson }) }));
jest.mock("sockjs-client", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("webstomp-client", () => ({ __esModule: true, default: { over: () => mockSocket } }));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn();
  mockRequestJson.mockImplementation(async (path: string) => path === "/room"
    ? { err_code: 0, data: [] } : { err_code: 0, data: { code: "ROOM-42", name: "Existing room" } });
});

test("Creating a room passes its name and user and opens the returned room code", async () => {
  render(<Chat />);
  await screen.findByPlaceholderText("Room Name...");
  mockRequestJson.mockResolvedValueOnce({ err_code: 0, data: { code: "CREATED-42", name: "My room" } });
  fireEvent.change(screen.getByPlaceholderText("Room Name..."), { target: { value: "My room" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/chat/rooms/CREATED-42?created=true"));
  expect(mockRequestJson).toHaveBeenLastCalledWith("/room", { method: "POST", body: { name: "My room", username: "alice" } });
});

test("Joining an existing room verifies its code and opens that room", async () => {
  render(<Chat />);
  await screen.findByPlaceholderText("Enter Room Code...");
  fireEvent.change(screen.getByPlaceholderText("Enter Room Code..."), { target: { value: "ROOM-42" } });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/chat/rooms/ROOM-42"));
  expect(mockRequestJson).toHaveBeenLastCalledWith("/room/ROOM-42");
});

test("Connected room sends to its destination and renders sender and broadcast content", async () => {
  render(<CloudChat />);
  act(() => mockConnected());
  expect(screen.getByText("Live Connection")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Type your message..."), { target: { value: "Hello room" } });
  fireEvent.submit(screen.getByPlaceholderText("Type your message...").closest("form")!);
  expect(mockSocket.send).toHaveBeenCalledWith("/app/sendMessage/ROOM-42", JSON.stringify({ sender: "alice", content: "Hello room" }));
  act(() => mockSubscriptions["/topic/group/ROOM-42"]({ body: JSON.stringify({ sender: "alice", content: "Hello room", timestamp: Date.now() }) }));
  expect(screen.getAllByText("Hello room")).toHaveLength(1);
  expect(screen.getByText("alice")).toBeInTheDocument();
});

test("Disconnected room disables sending until its live connection returns", () => {
  render(<CloudChat />);
  const input = screen.getByPlaceholderText("Type your message...");
  const button = input.closest("form")!.querySelector("button")!;
  fireEvent.change(input, { target: { value: "Cannot send yet" } });
  expect(screen.getByText("Reconnecting to chat...")).toBeInTheDocument();
  expect(button).toBeDisabled();
  act(() => mockConnected());
  expect(button).toBeEnabled();
  jest.spyOn(console, "error").mockImplementation(() => {});
  act(() => mockError(new Error("connection lost")));
  expect(button).toBeDisabled();
  expect(screen.getByText("Reconnecting to chat...")).toBeInTheDocument();
});
