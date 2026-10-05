import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import CloudMaps from "../../../remote/openmaps/components/OpenMaps/OpenMaps";

// Leaflet owns browser geometry and tiles. Keep application state, forms and
// HTTP hooks real, and expose marker positions and map events at that boundary.
let mockMapClick: (event: any) => void;
const mockMap = { invalidateSize: jest.fn() };
jest.mock("../../../remote/openmaps/node_modules/react-leaflet", () => {
  const React = require("react");
  const Container = ({ children }: any) => React.createElement("div", {}, children);
  const LayersControl = Object.assign(Container, { BaseLayer: Container });
  return { MapContainer: Container, TileLayer: () => null, Popup: Container, LayersControl,
    Marker: ({ position, children }: any) => React.createElement("div", { "data-testid": "vehicle-marker", "data-position": position.join(",") }, children),
    useMap: () => mockMap, useMapEvents: (handlers: any) => { mockMapClick = handlers.click; return mockMap; } };
});
const original = { id: 1, condition: "NEW", price: "$12,345", details: { model: "Roadster", manufacturer: { name: "Audi", code: 100 },
  externalColor: "Blue", body: "sedan", engine: "Electric", numberOfDoors: 4, mileage: 1, fuelType: "Electric", modelYear: 2026, productionYear: 2026 },
  location: { lat: 59.3282, lon: 18.0533 } };
let http: MockAdapter;
let fleet: any[];
beforeEach(() => {
  fleet = [JSON.parse(JSON.stringify(original))];
  Object.defineProperty(window, "matchMedia", { writable: true, value: jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
  jest.spyOn(window, "confirm").mockReturnValue(true);
  http = new MockAdapter(axios, { onNoMatch: "throwException" });
  http.onGet(/auth-check$/).reply(200, { roles: ["ROLE_ADMIN"] });
  http.onGet(/\/cars$/).reply(() => [200, JSON.parse(JSON.stringify(fleet))]);
  http.onPost(/\/cars$/).reply(config => { const car = { ...JSON.parse(config.data), id: 2, price: "$8,000" }; fleet.push(car); return [201, car]; });
  http.onPut(/\/cars\/1$/).reply(config => { fleet[0] = { ...JSON.parse(config.data), id: 1, price: "$12,345" }; return [200, fleet[0]]; });
  http.onDelete(/\/cars\/1$/).reply(() => { fleet = fleet.filter(car => car.id !== 1); return [200, {}]; });
});
afterEach(() => { http.restore(); jest.restoreAllMocks(); });
const completeForm = (dialog: HTMLElement, model: string) => {
  fireEvent.change(within(dialog).getByPlaceholderText("e.g. Impala"), { target: { value: model } });
  fireEvent.change(within(dialog).getByPlaceholderText("e.g. White"), { target: { value: "Green" } });
  fireEvent.change(within(dialog).getByPlaceholderText("e.g. 3.6L V6"), { target: { value: "Electric" } });
};

test("Vehicle list and map show the returned coordinates model and price", async () => {
  render(<CloudMaps />);
  await screen.findByText("59.3282, 18.0533");
  expect(screen.getByRole("heading", { name: "Audi Roadster" })).toBeInTheDocument();
  expect(within(screen.getByTestId("vehicle-marker")).getByText("Roadster")).toBeInTheDocument();
  expect(screen.getAllByText("$12,345")).toHaveLength(2);
  expect(screen.getByTestId("vehicle-marker")).toHaveAttribute("data-position", "59.3282,18.0533");
});

test("Regular map users have read-only controls while administrators create edit and delete", async () => {
  http.onGet(/auth-check$/).reply(200, { roles: ["ROLE_USER"] });
  const view = render(<CloudMaps />);
  await screen.findByText("Read-only vehicle map");
  expect(screen.queryByRole("button", { name: "Add vehicle" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit Roadster" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete Roadster" })).toBeNull();
  act(() => mockMapClick({ latlng: { lat: 60, lng: 19 } }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(http.history.post).toHaveLength(0);
  view.unmount();
  http.onGet(/auth-check$/).reply(200, { roles: ["ROLE_ADMIN"] });
  render(<CloudMaps />);
  await screen.findByText("Click on map to add vehicle");
  fireEvent.click(screen.getAllByRole("button", { name: "Add vehicle" })[0]);
  let dialog = screen.getByRole("dialog", { name: "Add Vehicle" });
  completeForm(dialog, "City Car");
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Vehicle" }));
  await screen.findAllByText("City Car");
  fireEvent.click(screen.getByRole("button", { name: "Edit Roadster" }));
  dialog = screen.getByRole("dialog", { name: "Edit Vehicle" });
  completeForm(dialog, "Updated Roadster");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));
  await screen.findAllByText("Updated Roadster");
  fireEvent.click(screen.getByRole("button", { name: "Delete Updated Roadster" }));
  await waitFor(() => expect(screen.queryByText("Updated Roadster")).toBeNull());
  expect(http.history.post).toHaveLength(1);
  expect(http.history.put).toHaveLength(1);
  expect(http.history.delete).toHaveLength(1);
  expect(screen.getAllByTestId("vehicle-marker")).toHaveLength(1);
});

test("Selected map coordinates are submitted and the created vehicle refreshes list and map", async () => {
  render(<CloudMaps />);
  await screen.findByText("Click on map to add vehicle");
  act(() => mockMapClick({ latlng: { lat: 60.123456, lng: 19.654321 } }));
  const dialog = screen.getByRole("dialog", { name: "Add Vehicle" });
  expect(within(dialog).getByDisplayValue("60.123456")).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue("19.654321")).toBeInTheDocument();
  completeForm(dialog, "Map Selection");
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Vehicle" }));
  await screen.findAllByText("Map Selection");
  expect(JSON.parse(http.history.post[0].data).location).toEqual({ lat: 60.123456, lon: 19.654321 });
  expect(http.history.get.filter(config => /\/cars$/.test(config.url!)).length).toBeGreaterThan(1);
  expect(screen.getAllByTestId("vehicle-marker").some(marker => marker.getAttribute("data-position") === "60.123456,19.654321")).toBe(true);
  expect(screen.getByText("60.1235, 19.6543")).toBeInTheDocument();
});
