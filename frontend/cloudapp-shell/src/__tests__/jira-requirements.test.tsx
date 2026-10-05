import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import CloudJira from "../../../remote/jira/pages/index";

let mockMessages: any[] = [];
const mockSend = jest.fn();
jest.mock("ai", () => ({ DefaultChatTransport: class {} }));
jest.mock("@ai-sdk/react", () => ({ useChat: () => ({ messages: mockMessages,
  setMessages: jest.fn(), sendMessage: mockSend, stop: jest.fn(), status: "ready" }) }));
const ticket = { id: "1", key: "DEMO-1", fields: { summary: "Original title", description: "Original description", issuetype: { name: "Task" } } };
let http: MockAdapter;

beforeEach(() => {
  mockMessages = [];
  process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY = "DEMO";
  HTMLElement.prototype.scrollIntoView = jest.fn();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ models: [
    { name: "test-model", size: 1024, details: { parameter_size: "1B" } },
  ] }) })) as any;
  http = new MockAdapter(axios, { onNoMatch: "throwException" });
  http.onPost(/\/get$/).reply(config => config.data.includes("search/jql")
    ? [200, { issues: [ticket] }] : [200, [{ id: "1", name: "Task" }, { id: "2", name: "Subtask" }]]);
  http.onPost(/\/post$/).reply(201, { key: "DEMO-2" });
  http.onPost(/\/delete$/).reply(200, {});
  http.onPut(/\/put$/).reply(200, {});
});
afterEach(() => { http.restore(); delete process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY; });

const mutations = () => http.history.post.filter(config => /\/(post|delete)$/.test(config.url!));
async function enableAssistant() {
  await screen.findAllByText("Original title");
  fireEvent.click(screen.getAllByRole("button", { name: "Local GPT" })[0]);
  await screen.findAllByTitle("Chat with Ticket");
}

test("Jira board scopes reads and performs explicit create edit delete proxy operations", async () => {
  render(<CloudJira />);
  await screen.findAllByText("Original title");
  expect(http.history.post.some(config => JSON.parse(config.data).jiraPath.includes("project=DEMO"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /New Ticket/ }));
  let dialog = screen.getByRole("dialog", { name: "Create New Ticket" });
  fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "New task" } });
  fireEvent.change(within(dialog).getAllByRole("combobox")[0], { target: { value: "Task" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mutations()).toHaveLength(1));
  expect(JSON.parse(mutations()[0].data).fields).toEqual(expect.objectContaining({ project: { key: "DEMO" }, summary: "New task" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getAllByTitle("Edit")[0]);
  dialog = screen.getByRole("dialog", { name: /Edit Ticket/ });
  fireEvent.change(within(dialog).getByDisplayValue("Original title"), { target: { value: "Updated title" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Save|Update/ }));
  await waitFor(() => expect(http.history.put).toHaveLength(1));
  expect(JSON.parse(http.history.put[0].data).update.summary).toEqual([{ set: "Updated title" }]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getAllByTitle("Delete")[0]);
  fireEvent.click(within(screen.getByRole("dialog", { name: /Delete/ })).getByRole("button", { name: /Delete/ }));
  await waitFor(() => expect(mutations()).toHaveLength(2));
  expect(JSON.parse(mutations()[1].data).jiraPath).toBe("/rest/api/latest/issue/DEMO-1");
});

test("Jira AI comparison remains read-only until explicit approval", async () => {
  const view = render(<CloudJira />);
  await enableAssistant();
  fireEvent.click(screen.getAllByTitle("Chat with Ticket")[0]);
  await waitFor(() => expect(mockSend).toHaveBeenCalled());
  mockMessages = [{ id: "proposal", role: "assistant", parts: [{ type: "text", text: "Proposed description" }] }];
  view.rerender(<CloudJira />);
  fireEvent.click(screen.getAllByRole("button", { name: "Apply as Changes" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Compare & Approve Changes" });
  expect(within(dialog).getByText("Original description")).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue("Proposed description")).toBeInTheDocument();
  expect(http.history.put).toHaveLength(0);
  expect(mutations()).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Approve & Update" }));
  await waitFor(() => expect(http.history.put).toHaveLength(1));
  expect(JSON.parse(http.history.put[0].data)).toEqual({ jiraPath: "/rest/api/latest/issue/DEMO-1",
    update: { summary: [{ set: "Improved Original title" }], description: [{ set: "Proposed description" }] } });
});

test("Jira child creation excludes unselected and whitespace-only suggestions", async () => {
  const view = render(<CloudJira />);
  await enableAssistant();
  fireEvent.click(screen.getAllByTitle("Batch Create")[0]);
  const dialog = screen.getByRole("dialog", { name: "Batch Create Tickets" });
  fireEvent.change(within(dialog).getByDisplayValue("5"), { target: { value: "3" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Ask AI for Suggestions" }));
  await waitFor(() => expect(mockSend).toHaveBeenCalled());
  mockMessages = [{ id: "children", role: "assistant", parts: [{ type: "text", text: JSON.stringify([
    { summary: "Selected child", description: "first" }, { summary: "Blank child", description: "second" },
    { summary: "Unselected child", description: "third" },
  ]) }] }];
  await act(async () => { view.rerender(<CloudJira />); });
  await within(dialog).findByDisplayValue("Selected child");
  fireEvent.change(within(dialog).getByDisplayValue("Blank child"), { target: { value: "   " } });
  fireEvent.click(within(dialog).getAllByRole("checkbox")[2]);
  expect(mutations()).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Selected" }));
  await waitFor(() => expect(mutations()).toHaveLength(1));
  expect(JSON.parse(mutations()[0].data).fields).toEqual({ project: { key: "DEMO" }, summary: "Selected child",
    description: "first", issuetype: { name: "Subtask" }, parent: { key: "DEMO-1" } });
});
