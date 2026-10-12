import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CloudMLOps from "../../../remote/mlops/pages/index";

// Keep the real chart implementation; give ResponsiveContainer fixed geometry
// because jsdom has no layout engine.
jest.mock("../../../remote/mlops/node_modules/recharts", () => ({
  ...jest.requireActual("../../../remote/mlops/node_modules/recharts"),
  ResponsiveContainer: ({ children }: any) => require("react").cloneElement(children, { width: 640, height: 320 }),
}));
const rows = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, gender: "Female", age: 20 + index,
  annual_income: 40 + index, spending_score: 50 + index, segment: index % 2 }));
const data = {
  spending_histogram: { data: rows.map(row => row.spending_score), bins: 10, title: "spending_score" },
  pairplot_data: { age: rows.map(row => row.age), annual_income: rows.map(row => row.annual_income),
    spending_score: rows.map(row => row.spending_score), gender: rows.map(row => row.gender) },
  cluster_scatter: { pca_component_1: rows.map((_, i) => i), pca_component_2: rows.map((_, i) => i / 2),
    segment: rows.map(row => row.segment), customer_id: rows.map(row => row.id), n_clusters: 2, title: "Clusters" },
  segment_metadata: { 0: { color: "#123456", centroid_age: 24, centroid_income: 44, centroid_spending: 54 },
    1: { color: "#654321", centroid_age: 25, centroid_income: 45, centroid_spending: 55 } },
};
let calls: { url: string; init?: RequestInit }[];
beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (input: any, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return { ok: true, json: async () => String(input).includes("getSegmentationCustomers") ? rows : data };
  }) as any;
});

test("MLOps sample submission refreshes chart results and customer records", async () => {
  const { container } = render(<CloudMLOps />);
  await screen.findByText("Total: 10");
  fireEvent.click(screen.getByRole("button", { name: "20" }));
  await waitFor(() => expect(calls.some(call => call.init?.body === JSON.stringify({ sampleSize: 20 }))).toBe(true));
  await waitFor(() => expect(container.querySelector("svg.recharts-surface")).not.toBeNull());
  expect(calls.at(-1)?.url).toContain("getSegmentationCustomers");
});

test("MLOps customer form submits its attributes then reclusters and refreshes results", async () => {
  const { container } = render(<CloudMLOps />);
  await screen.findByText("Total: 10");
  calls = [];
  fireEvent.change(container.querySelector("input[name='age']")!, { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Add & Re-Cluster" }));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(calls.map(call => call.url.split("/").at(-1))).toEqual(["addCustomer", "getMLInfo", "getSegmentationCustomers"]);
  expect(JSON.parse(calls[0].init!.body as string).fields).toEqual({ gender: "Female", age: 42, annual_income: 50, spending_score: 50, segment: 0 });
  expect(JSON.parse(calls[1].init!.body as string)).toEqual({ sampleSize: -1 });
});

test("MLOps renders cluster and spending charts and paginates actual table rows", async () => {
  const { container } = render(<CloudMLOps />);
  await screen.findByText("Total: 10");
  await waitFor(() => expect(container.querySelector("svg.recharts-surface")).not.toBeNull());
  expect(container.querySelectorAll(".recharts-scatter-symbol").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /Spending|Histogram/i }));
  await waitFor(() => expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0));
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(9);
  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next customer page" }));
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByText("9")).toBeInTheDocument();
  expect(within(table).queryByText("1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous customer page" }));
  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
});
