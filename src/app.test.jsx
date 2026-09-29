// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { RECORDS_KEY, ROLE_KEY } from "./state.jsx";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

function savedLibrary() {
  return JSON.parse(localStorage.getItem(RECORDS_KEY));
}

function activeGame(library = savedLibrary()) {
  return library.games.find((game) => game.id === library.activeGameId);
}

function renderScorebook() {
  localStorage.setItem(ROLE_KEY, "scorekeeper");
  window.history.replaceState(null, "", "/scorebook");
  return render(<StrictMode><App /></StrictMode>);
}

describe("Diamond Live shell", () => {
  it("switches from Coach Dana to Scorekeeper Priya and opens the book", () => {
    window.history.replaceState(null, "", "/demo");
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

  it("keeps one event per action and restores the count after a Strict Mode remount", () => {
    const app = renderScorebook();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    fireEvent.click(screen.getByRole("button", { name: "Ball" }));
    const recorded = activeGame();

    expect(recorded.events.map((event) => event.action.type)).toEqual(["start", "pitch"]);
    expect(new Set(recorded.events.map((event) => event.id)).size).toBe(2);
    expect(screen.getByText("Breakers batter 1 · 1-0")).toBeTruthy();

    app.unmount();
    render(<StrictMode><App /></StrictMode>);

    expect(screen.getByText("Breakers batter 1 · 1-0")).toBeTruthy();
    expect(activeGame()).toEqual(recorded);
    expect(within(screen.getByRole("list", { name: "Complete play history" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps an unsaved pitch visible and retries the same event after storage fills up", () => {
    renderScorebook();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    const previous = activeGame();
    const originalSetItem = Storage.prototype.setItem;
    let refuseSave = true;
    let failedLibrary;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === RECORDS_KEY && refuseSave) {
        failedLibrary = JSON.parse(value);
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });

    fireEvent.click(screen.getByRole("button", { name: "Ball" }));

    expect(screen.getByRole("alert").textContent).toMatch(/storage is full/i);
    expect(screen.getByText(/Changes not yet saved/)).toBeTruthy();
    expect(screen.getByText("Breakers batter 1 · 1-0")).toBeTruthy();
    expect(activeGame()).toEqual(previous);
    const pendingEvents = activeGame(failedLibrary).events;
    expect(pendingEvents).toHaveLength(2);

    refuseSave = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Saved on this device/)).toBeTruthy();
    expect(activeGame().events).toEqual(pendingEvents);
    expect(new Set(activeGame().events.map((event) => event.id)).size).toBe(2);
    expect(screen.getByText("Breakers batter 1 · 1-0")).toBeTruthy();
  });

  it.each([
    ["corrupt", "{broken"],
    ["future", JSON.stringify({ schemaVersion: 99 })],
  ])("preserves %s storage and pauses scoring in Strict Mode", (_kind, raw) => {
    localStorage.setItem(RECORDS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    renderScorebook();

    expect(screen.getByRole("heading", { name: "Saved game needs attention" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/saved games have not been changed/i);
    expect(screen.queryByRole("button", { name: "Ball" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start first pitch" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading saved games" }));

    expect(localStorage.getItem(RECORDS_KEY)).toBe(raw);
    expect(writes.mock.calls.filter(([key]) => key === RECORDS_KEY)).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Saved game needs attention" })).toBeTruthy();
  });

  it("archives the previous game on reset and reloads the new active game", () => {
    const app = renderScorebook();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    fireEvent.click(screen.getByRole("button", { name: "Home run" }));
    const previous = activeGame();

    fireEvent.click(screen.getByRole("button", { name: "Reset Saturday" }));

    const resetLibrary = savedLibrary();
    expect(resetLibrary.games).toHaveLength(2);
    expect(resetLibrary.games.find((game) => game.id === previous.id)).toEqual(previous);
    expect(resetLibrary.activeGameId).not.toBe(previous.id);
    expect(activeGame(resetLibrary).events).toEqual([]);
    expect(screen.getByText("Waiting on first pitch")).toBeTruthy();

    app.unmount();
    render(<StrictMode><App /></StrictMode>);

    expect(savedLibrary()).toEqual(resetLibrary);
    expect(screen.getByText("Waiting on first pitch")).toBeTruthy();
    expect(screen.getByText("No pitches recorded in this game yet.")).toBeTruthy();
  });

  it("undoes a pitch after a coach note while preserving the note and visible audit", () => {
    renderScorebook();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    fireEvent.click(screen.getByRole("button", { name: "Ball" }));
    const pitch = activeGame().events.at(-1);

    fireEvent.click(screen.getByRole("radio", { name: /Coach Dana/ }));
    fireEvent.click(screen.getByRole("link", { name: "Saturday" }));
    fireEvent.change(screen.getByLabelText("Dugout note"), { target: { value: "Work on first-pitch strikes." } });
    const note = activeGame().events.at(-1);
    fireEvent.click(screen.getByRole("radio", { name: /Scorekeeper Priya/ }));
    fireEvent.click(screen.getByRole("link", { name: "Scorebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo last pitch" }));

    expect(screen.getByText("Breakers batter 1 · 0-0")).toBeTruthy();
    const audit = screen.getByRole("list", { name: "Complete play history" });
    expect(audit.textContent).toMatch(/ball.*Undone/);
    expect(audit.textContent).toMatch(/Undid pitch #2/);
    expect(within(audit).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo last pitch" }).disabled).toBe(true);
    const events = activeGame().events;
    expect(events).toHaveLength(4);
    expect(events[1]).toEqual(pitch);
    expect(events[2]).toEqual(note);
    expect(events[3].targetEventId).toBe(pitch.id);

    fireEvent.click(screen.getByRole("radio", { name: /Coach Dana/ }));
    fireEvent.click(screen.getByRole("link", { name: "Saturday" }));
    expect(screen.getByLabelText("Dugout note").value).toBe("Work on first-pitch strikes.");
  });
});
