// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Prototype from "./Prototype.jsx";
import { readSharedLink, capturePrefix } from "./shareCapture.js";
import { makeResource, RESOURCE_KEY, useVideoLibrary } from "./drillResources.js";

beforeEach(() => {
  localStorage.removeItem(RESOURCE_KEY);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(RESOURCE_KEY);
});

function LocationReadout() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.search}
      {location.hash}
    </output>
  );
}
function open(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Prototype />
      <LocationReadout />
    </MemoryRouter>,
  );
}

it("reads raw shared URL fragments without corrupting nested parameters or percent escapes", () => {
  const url = "https://www.instagram.com/reel/example/?x=a%2Bb&foo=bar#part";
  expect(readSharedLink({ hash: `#${url}` }).url).toBe(url);
  expect(readSharedLink({ hash: `#url=${encodeURIComponent(url)}` }).url).toBe(url);
  expect(readSharedLink({ hash: `#${encodeURIComponent(url)}` }).url).toBe(url);
  expect(
    readSharedLink({ search: `?capture=1&text=${encodeURIComponent(`Watch this ${url}`)}` }).url,
  ).toBe(url);
  expect(readSharedLink({ hash: "" })).toEqual({ url: "", title: "" });
  expect(capturePrefix("https://example.org/diamond-live/prototype?view=desk")).toBe(
    "https://example.org/diamond-live/prototype?capture=1#",
  );
});

it("rejects unsafe and ambiguous shared input", () => {
  for (const hash of [
    "#javascript:alert(1)",
    "#https://user:secret@example.org/video",
    "#https://one.example/video https://two.example/video",
    `#${"x".repeat(6001)}`,
  ])
    expect(() => readSharedLink({ hash })).toThrow();
});

it("saves a shared link to the inbox with no skill selection and removes the shared URL on leaving capture", () => {
  open("/prototype?capture=1#https://youtu.be/abcdefghijk?si=tracking");
  expect(localStorage.getItem(RESOURCE_KEY)).toBeNull(); // Opening a GET link does not mutate storage.
  fireEvent.click(screen.getByRole("button", { name: "Save to Drill Inbox" }));
  expect(screen.getByRole("heading", { name: "Saved for your next practice." })).toBeTruthy();
  const records = JSON.parse(localStorage.getItem(RESOURCE_KEY));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "YouTube link",
    drillId: "",
    reviewed: false,
  });
  fireEvent.click(screen.getByRole("button", { name: "Open Drill Inbox" }));
  expect(screen.getByRole("button", { name: "Inbox (1)" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("button", { name: "Open lesson for YouTube link" })).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe("?view=library&section=inbox");
});

it("reports duplicates without changing an existing reviewed lesson", () => {
  const existing = makeResource({
    id: "existing",
    title: "My reviewed video",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    drillId: "balanced-tee",
    reviewed: true,
    notes: "Keep this cue",
  });
  localStorage.setItem(RESOURCE_KEY, JSON.stringify([existing]));
  open("/prototype?capture=1#https://youtu.be/abcdefghijk");
  fireEvent.click(screen.getByRole("button", { name: "Save to Drill Inbox" }));
  expect(screen.getByRole("heading", { name: "Already in your library." })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(RESOURCE_KEY))).toEqual([existing]);
  fireEvent.click(screen.getByRole("button", { name: "Open video library" }));
  expect(screen.getByRole("button", { name: "Open lesson for My reviewed video" })).toBeTruthy();
});

it("keeps a practice draft intact through Quick Save and opens the existing library on its Inbox filter", () => {
  open("/prototype?view=library");
  fireEvent.click(
    screen.getByRole("button", { name: "Add Quiet glove grounders to practice draft" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Video links" }));
  fireEvent.click(screen.getByRole("link", { name: "Quick save" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Video or post link" }), {
    target: { value: "https://example.org/shared-from-phone" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save to Drill Inbox" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Drill Inbox" }));
  expect(screen.getByRole("button", { name: "Inbox (1)" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: /^Drills/ }));
  expect(screen.getByText("8 minutes selected · local preview")).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name: "Coach Desk" }),
  );
  expect(screen.getByRole("heading", { name: "A good day to get better." })).toBeTruthy();
});

it("never claims a durable save when browser storage is blocked", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  open("/prototype?capture=1#https://example.org/drill");
  fireEvent.click(screen.getByRole("button", { name: "Save to Drill Inbox" }));
  expect(screen.getByRole("heading", { name: "Kept for this session." })).toBeTruthy();
  expect(within(screen.getByRole("main")).getByRole("status").textContent).toContain(
    "will not survive a reload",
  );
});

it("merges a capture from another tab before the next library edit and responds to storage events", () => {
  const first = renderHook(() => useVideoLibrary());
  const second = renderHook(() => useVideoLibrary());
  act(() => second.result.current.capture("https://example.org/shared"));
  act(() =>
    first.result.current.save({
      title: "Manual save",
      url: "https://example.org/manual",
      drillId: "balanced-tee",
    }),
  );
  expect(JSON.parse(localStorage.getItem(RESOURCE_KEY))).toHaveLength(2);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: RESOURCE_KEY })));
  expect(second.result.current.resources).toHaveLength(2);
  expect(second.result.current.resources.find((item) => !item.drillId).reviewed).toBe(false);
});
