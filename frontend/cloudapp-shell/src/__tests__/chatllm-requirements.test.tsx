import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatLLM from "../../../remote/chatllm/pages/index";

const mockSetMessages = jest.fn();
const mockSend = jest.fn();
let mockReceive: (messages: any[]) => void;
jest.mock("ai", () => ({ DefaultChatTransport: class {} }));
jest.mock("@ai-sdk/react", () => ({ useChat: () => {
  const [messages, setMessages] = require("react").useState([
    { id: "old", role: "assistant", parts: [{ type: "text", text: "Prior conversation" }] },
  ]);
  mockReceive = setMessages;
  return { messages, setMessages: React.useCallback((value: any) => { mockSetMessages(value); setMessages(value); }, []),
    sendMessage: mockSend, stop: jest.fn(), status: "ready" };
} }));

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ models: [
    { name: "model-a", size: 1024, details: { parameter_size: "1B" } },
    { name: "model-b", size: 1024, details: { parameter_size: "2B" } },
    { name: "embedding-only", size: 1024, details: { parameter_size: "1B" } },
  ] }) })) as any;
  HTMLElement.prototype.scrollIntoView = jest.fn();
});

test("ChatLLM selects available chat models and sends the chosen model", async () => {
  render(<ChatLLM />);
  await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("model-a"));
  expect(screen.queryByRole("option", { name: /embedding-only/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "model-b" } });
  fireEvent.change(screen.getByPlaceholderText("Message GPT..."), { target: { value: "hello" } });
  fireEvent.submit(screen.getByPlaceholderText("Message GPT...").closest("form")!);
  await waitFor(() => expect(mockSend).toHaveBeenCalledWith(
    { role: "user", parts: [{ type: "text", text: "hello" }] }, { body: { model: "model-b" } },
  ));
  act(() => mockReceive([{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Hello" }] }]));
  expect(screen.getByText("Hello")).toBeInTheDocument();
  act(() => mockReceive([{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Hello from the selected model" }] }]));
  expect(screen.getByText("Hello from the selected model")).toBeInTheDocument();
});

test("Changing the selected ChatLLM model clears the rendered conversation", async () => {
  render(<ChatLLM />);
  await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("model-a"));
  expect(screen.getByText("Prior conversation")).toBeInTheDocument();
  expect(mockSetMessages).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "model-b" } });
  await waitFor(() => expect(screen.queryByText("Prior conversation")).toBeNull());
  expect(mockSetMessages).toHaveBeenCalledWith([]);
  expect(screen.getByText("model-b", { selector: "strong" })).toBeInTheDocument();
});
