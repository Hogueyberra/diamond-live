// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App.jsx";
import { ROLE_KEY, STATE_KEY } from "./state.jsx";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(ROLE_KEY);
});

describe("Diamond Live shell", () => {
  it("switches from Coach Dana to Scorekeeper Priya and opens the book", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Tustin 10U Hawks" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Hawks vs Laguna 10U Breakers/ })).toBeTruthy();

    const priya = screen.getByRole("radio", { name: /Scorekeeper Priya/ });
    fireEvent.click(priya);
    expect(priya.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("heading", { name: "Open the book" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Scorebook" }));
    expect(screen.getByRole("heading", { name: "Scorebook" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    fireEvent.click(screen.getByRole("button", { name: "Ball" }));
    expect(screen.getAllByText(/1-0/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Reset Saturday" }));
    expect(screen.getByRole("status").textContent).toMatch(/Saturday morning restored/);
    expect(screen.getAllByText(/First pitch 10:00 AM/).length).toBeGreaterThan(0);
  });
});
