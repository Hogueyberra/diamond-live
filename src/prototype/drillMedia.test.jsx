// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DrillDiagram from "./DrillDiagram.jsx";
import { PRACTICE_DRILLS } from "../practicePlanning.js";
import { useVideoLibrary, RESOURCE_KEY } from "./drillResources.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem(RESOURCE_KEY);
});

it("plays only on request, pauses, and suspends playback when the workspace is hidden", () => {
  vi.useFakeTimers();
  const drill = PRACTICE_DRILLS.find((item) => item.id === "balanced-tee");
  const { rerender } = render(<DrillDiagram drill={drill} controls />);
  act(() => vi.advanceTimersByTime(2400));
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Balanced stance");
  fireEvent.click(screen.getByRole("button", { name: "Play demonstration" }));
  act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Controlled swing");
  fireEvent.click(screen.getByRole("button", { name: "Pause demonstration" }));
  act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Controlled swing");
  fireEvent.click(screen.getByRole("button", { name: "Play demonstration" }));
  rerender(<DrillDiagram drill={drill} controls active={false} />);
  act(() => vi.advanceTimersByTime(2400));
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Controlled swing");
});

it("keeps a usable session library if storage is blocked", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  const { result } = renderHook(() => useVideoLibrary());
  act(() =>
    result.current.save({
      title: "Example",
      url: "https://example.org/drill",
      drillId: "balanced-tee",
    }),
  );
  expect(result.current.persistent).toBe(false);
  expect(result.current.resources[0].title).toBe("Example");
  act(() => result.current.remove(result.current.resources[0].id));
  expect(result.current.resources).toEqual([]);
});

it("ignores invalid persisted entries and preserves valid saved links", () => {
  localStorage.setItem(
    RESOURCE_KEY,
    JSON.stringify([
      { title: "Bad", url: "javascript:alert(1)", drillId: "balanced-tee" },
      { title: "Valid", url: "https://example.org/drill", drillId: "balanced-tee", reviewed: true },
      { title: "Unknown drill", url: "https://example.org/other", drillId: "missing" },
    ]),
  );
  const { result } = renderHook(() => useVideoLibrary());
  expect(result.current.resources).toHaveLength(1);
  expect(result.current.resources[0].title).toBe("Valid");
});
