// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { COACHING_KEY } from "./coachingStore.js";
import { RECORDS_KEY, ROLE_KEY } from "./state.jsx";

// This suite exercises the local demo, independent of the developer's live account configuration.
vi.mock('./supabaseClient.js', () => ({ supabase: null, cloudConfigured: false, configError: null }));

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/preview");
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() { this.removeAttribute("open"); },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  for (const [name, descriptor] of [["showModal", originalShowModal], ["close", originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete HTMLDialogElement.prototype[name];
  }
});

function renderApp() {
  return render(<StrictMode><App /></StrictMode>);
}

function addObservation(title, note) {
  fireEvent.click(screen.getByRole("button", { name: "Add a coaching note" }));
  const dialog = screen.getByRole("dialog", { name: "Capture a coaching note" });
  fireEvent.change(within(dialog).getByLabelText("Coaching priority"), { target: { value: title } });
  fireEvent.change(within(dialog).getByLabelText("Observation"), { target: { value: note } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save observation" }));
}

function savedWorkspace() {
  return JSON.parse(localStorage.getItem(COACHING_KEY));
}

function activeSavedGame() {
  const library = JSON.parse(localStorage.getItem(RECORDS_KEY));
  return library.games.find((game) => game.id === library.activeGameId);
}

describe("coaching workspace", () => {
  it("turns a coach observation into a reviewed practice activity and preserves its outcome on reload", async () => {
    const app = renderApp();
    addObservation("Choose the relay target", "Players waited for a reminder before identifying the next base.");
    const noteCard = screen.getByRole("heading", { name: "Choose the relay target" }).closest("li");
    fireEvent.click(within(noteCard).getByRole("button", { name: "Review & plan" }));

    let dialog = screen.getByRole("dialog", { name: "Review & plan a practice activity" });
    expect(within(dialog).getByText("Players waited for a reminder before identifying the next base.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Practice"), { target: { value: "practice-1" } });
    fireEvent.change(within(dialog).getByLabelText("Activity name"), { target: { value: "Relay decision reps" } });
    fireEvent.change(within(dialog).getByLabelText("Minutes"), { target: { value: "12" } });
    fireEvent.change(within(dialog).getByLabelText("Practice objective"), { target: { value: "Call the target before receiving the ball." } });
    fireEvent.change(within(dialog).getByLabelText("What would progress look like?"), { target: { value: "Five consecutive clear target calls." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve & add to practice" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Takeaway reviewed and added/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open practice plan" }));
    dialog = screen.getByRole("dialog", { name: "Fielding & first-base footwork" });
    expect(within(dialog).getByText("32 min planned")).toBeTruthy();
    const activity = within(dialog).getByRole("heading", { name: "Relay decision reps" }).closest(".cw-activity");
    expect(within(activity).getByText("Call the target before receiving the ball.")).toBeTruthy();
    expect(within(activity).getByText("Five consecutive clear target calls.", { exact: false })).toBeTruthy();
    fireEvent.click(within(activity).getByRole("checkbox", { name: "Completed in practice" }));
    await waitFor(() => expect(within(activity).getByRole('textbox', { name: 'Outcome for Relay decision reps' }).disabled).toBe(false));
    const outcome = within(activity).getByRole("textbox", { name: "Outcome for Relay decision reps" });
    fireEvent.change(outcome, { target: { value: "Four clear calls in a row; repeat next practice." } });
    fireEvent.blur(outcome);
    await waitFor(() => expect(savedWorkspace().activities.find((item) => item.title === 'Relay decision reps').outcome).toBe('Four clear calls in a row; repeat next practice.'));
    await waitFor(() => expect(within(activity).getByRole('textbox', { name: 'Outcome for Relay decision reps' }).disabled).toBe(false));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));

    const saved = savedWorkspace();
    const note = saved.observations.find((item) => item.title === "Choose the relay target");
    const planned = saved.activities.find((item) => item.title === "Relay decision reps");
    expect(note.status).toBe("planned");
    expect(planned).toMatchObject({
      teamId: "angels-demo", seasonId: "fall-2026-demo", eventId: "practice-1", observationId: note.id,
      minutes: 12, completed: true, outcome: "Four clear calls in a row; repeat next practice.",
    });

    app.unmount();
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open practice plan" }));
    dialog = screen.getByRole("dialog", { name: "Fielding & first-base footwork" });
    const restored = within(dialog).getByRole("heading", { name: "Relay decision reps" }).closest(".cw-activity");
    expect(within(restored).getByRole("checkbox", { name: "Completed in practice" }).checked).toBe(true);
    expect(within(restored).getByRole("textbox", { name: "Outcome for Relay decision reps" }).value).toBe("Four clear calls in a row; repeat next practice.");
    expect(savedWorkspace()).toEqual(saved);
  });

  it("keeps each team's schedules, observations, and practice choices isolated", () => {
    renderApp();
    fireEvent.change(screen.getByRole("combobox", { name: "Team and season" }), { target: { value: "seals-demo" } });
    expect(screen.queryByRole("heading", { name: "Fielding & first-base footwork" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Make the next throw a clear decision" })).toBeNull();

    addObservation("Seals throwing focus", "Use a clear target during warm-up.");
    const noteCard = screen.getByRole("heading", { name: "Seals throwing focus" }).closest("li");
    fireEvent.click(within(noteCard).getByRole("button", { name: "Review & plan" }));
    const review = screen.getByRole("dialog", { name: "Review & plan a practice activity" });
    expect(within(review).getByText("Add a practice before planning an activity.")).toBeTruthy();
    expect(within(review).queryByRole("combobox", { name: "Practice" })).toBeNull();
    fireEvent.click(within(review).getByRole("button", { name: "Close dialog" }));

    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    const eventDialog = screen.getByRole("dialog", { name: "Add an event" });
    fireEvent.change(within(eventDialog).getByLabelText("Event name"), { target: { value: "Seals throwing practice" } });
    fireEvent.change(within(eventDialog).getByLabelText("Location"), { target: { value: "Seals practice field" } });
    fireEvent.click(within(eventDialog).getByRole("button", { name: "Save event" }));
    expect(screen.getByRole("heading", { name: "Seals throwing practice" })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Team and season" }), { target: { value: "angels-demo" } });
    expect(screen.queryByRole("heading", { name: "Seals throwing practice" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Seals throwing focus" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Fielding & first-base footwork" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Make the next throw a clear decision" })).toBeTruthy();

    const saved = savedWorkspace();
    expect(saved.events.find((item) => item.title === "Seals throwing practice")).toMatchObject({ teamId: "seals-demo", seasonId: "fall-2026-demo" });
    expect(saved.observations.find((item) => item.title === "Seals throwing focus")).toMatchObject({ teamId: "seals-demo", seasonId: "fall-2026-demo" });
    expect(saved.activities.every((item) => item.teamId === "angels-demo")).toBe(true);
  });

  it("retains an unsaved pitch while navigating through coaching and retries that same event", () => {
    localStorage.setItem(ROLE_KEY, "scorekeeper");
    window.history.replaceState(null, "", "/scorebook");
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Start first pitch" }));
    const before = activeSavedGame();
    const originalSetItem = Storage.prototype.setItem;
    let rejectWrites = true;
    let pending;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === RECORDS_KEY && rejectWrites) {
        pending = JSON.parse(value);
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });
    fireEvent.click(screen.getByRole("button", { name: "Ball" }));
    const pendingGame = pending.games.find((game) => game.id === pending.activeGameId);
    expect(screen.getByRole("alert").textContent).toMatch(/storage is full/i);
    expect(activeSavedGame()).toEqual(before);

    fireEvent.click(screen.getByRole("link", { name: "Back to coaching home" }));
    expect(screen.getByRole("heading", { name: /This week with.*the Angels/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Open Hawks scoring demo" }));
    fireEvent.click(screen.getByRole("link", { name: "Scorebook" }));
    expect(screen.getByText("Breakers batter 1 · 1-0")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/storage is full/i);

    rejectWrites = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));
    expect(activeSavedGame()).toEqual(pendingGame);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens and saves the coaching workspace while a corrupt game archive remains untouched", () => {
    const corrupt = "{unreadable-scoring-archive";
    localStorage.setItem(RECORDS_KEY, corrupt);
    const originalSetItem = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      return originalSetItem.call(this, key, value);
    });
    renderApp();
    expect(screen.getByRole("heading", { name: /This week with.*the Angels/ })).toBeTruthy();
    addObservation("Preserved coaching note", "The team called each other's names before throwing.");
    expect(savedWorkspace().observations.some((note) => note.title === "Preserved coaching note")).toBe(true);
    expect(localStorage.getItem(RECORDS_KEY)).toBe(corrupt);
    expect(writes.mock.calls.some(([key]) => key === RECORDS_KEY)).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Open Hawks scoring demo" }));
    expect(screen.getByRole("heading", { name: "Saved game needs attention" })).toBeTruthy();
    expect(localStorage.getItem(RECORDS_KEY)).toBe(corrupt);
  });

  it("retains an unsaved coaching note when visiting the scoring demo and returning", () => {
    renderApp();
    const originalSetItem = Storage.prototype.setItem;
    let rejectWrites = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === COACHING_KEY && rejectWrites) throw new DOMException("Storage full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    addObservation("Keep this unsaved priority", "Practice calling the target before the catch.");
    expect(screen.getByRole("alert").textContent).toMatch(/have not been saved/i);
    expect(localStorage.getItem(COACHING_KEY)).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Open Hawks scoring demo" }));
    fireEvent.click(screen.getByRole("link", { name: "Back to coaching home" }));

    expect(screen.getByRole("heading", { name: "Keep this unsaved priority" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/have not been saved/i);
    rejectWrites = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));
    expect(savedWorkspace().observations.some((note) => note.title === "Keep this unsaved priority")).toBe(true);
  });
});
