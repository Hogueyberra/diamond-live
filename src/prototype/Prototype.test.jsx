// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Prototype from "./Prototype.jsx";
import { RESOURCE_KEY } from "./drillResources.js";
import { ASSESSMENT_KEY } from "./playerAssessments.js";

const prototypeMethods = [
  [HTMLDialogElement.prototype, "showModal"],
  [HTMLDialogElement.prototype, "close"],
  [Element.prototype, "scrollIntoView"],
].map(([prototype, name]) => ({
  prototype,
  name,
  descriptor: Object.getOwnPropertyDescriptor(prototype, name),
}));

beforeEach(() => {
  window.localStorage.removeItem(RESOURCE_KEY);
  window.localStorage.removeItem(ASSESSMENT_KEY);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(ASSESSMENT_KEY);
  for (const { prototype, name, descriptor } of prototypeMethods) {
    if (descriptor) Object.defineProperty(prototype, name, descriptor);
    else delete prototype[name];
  }
});
function open() {
  return render(
    <MemoryRouter initialEntries={["/prototype"]}>
      <Prototype />
    </MemoryRouter>,
  );
}
function navigate(name) {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Clubhouse navigation" })).getByRole("button", {
      name,
    }),
  );
}

it("keeps a reviewed suggestion resolved after navigating away and back", () => {
  open();
  fireEvent.click(screen.getAllByRole("button", { name: /^Review/ })[0]);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /Approve in prototype/ }));
  expect(screen.getAllByRole("button", { name: /^Review/ })).toHaveLength(2);
  navigate("Players");
  navigate("Coach Desk");
  expect(screen.getAllByRole("button", { name: /^Review/ })).toHaveLength(2);
  expect(screen.getByText("Approved by you · Updated in this prototype")).toBeTruthy();
});

it("carries the selected player into development and retains an edited approved plan", () => {
  open();
  navigate("Players");
  fireEvent.change(screen.getByRole("textbox", { name: "Search players" }), {
    target: { value: "Mason" },
  });
  fireEvent.click(screen.getByRole("button", { name: /4\s*Mason Brooks/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review development plan" }));
  expect(screen.getByRole("heading", { name: "Mason Brooks" })).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Coaching cue" }), {
    target: { value: "Balanced contact, then finish." },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /Station duration/ }), {
    target: { value: "15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve practice proposal" }));
  navigate("Coach Desk");
  navigate("Development");
  expect(screen.getByRole("textbox", { name: "Coaching cue" }).value).toBe(
    "Balanced contact, then finish.",
  );
  expect(screen.getByText("Proposal approved in this demo")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Coaching cue" }).disabled).toBe(true);
  expect(screen.getByRole("spinbutton", { name: /Station duration/ }).value).toBe("15");
  // Development has already mounted: a new player must replace its selected detail.
  navigate("Players");
  fireEvent.change(screen.getByRole("textbox", { name: "Search players" }), {
    target: { value: "Noah" },
  });
  fireEvent.click(screen.getByRole("button", { name: /12\s*Noah Martinez/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review development plan" }));
  expect(screen.getByRole("heading", { name: "Noah Martinez" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Coaching cue" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /4\s*Mason Brooks/ }));
  expect(screen.getByRole("textbox", { name: "Coaching cue" }).value).toBe(
    "Balanced contact, then finish.",
  );
  expect(screen.getByRole("spinbutton", { name: /Station duration/ }).value).toBe("15");
  fireEvent.click(screen.getByRole("button", { name: "Record demo practice complete" }));
  expect(screen.getByText("Practice recorded as complete")).toBeTruthy();
  expect(
    screen.getByText("Next step: observe the skill again. No rating has changed."),
  ).toBeTruthy();
});

it("works when browser storage is unavailable and rejects an incomplete practice proposal", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("Storage disabled", "SecurityError");
  });
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Storage disabled", "SecurityError");
  });
  open();
  navigate("Players");
  fireEvent.click(screen.getByRole("button", { name: "Review development plan" }));
  expect(screen.getByRole("heading", { name: "Noah Martinez" })).toBeTruthy();
  const approve = screen.getByRole("button", { name: "Approve practice proposal" });
  const cue = screen.getByRole("textbox", { name: "Coaching cue" });
  fireEvent.change(cue, { target: { value: "   " } });
  expect(approve.disabled).toBe(true);
  fireEvent.change(cue, { target: { value: "Set the feet before the throw." } });
  const duration = screen.getByRole("spinbutton", { name: /Station duration/ });
  fireEvent.change(duration, { target: { value: "4" } });
  expect(approve.disabled).toBe(true);
  fireEvent.change(duration, { target: { value: "12" } });
  expect(approve.disabled).toBe(false);
});

it("supports an empty player search and recovery", () => {
  open();
  navigate("Players");
  fireEvent.change(screen.getByRole("textbox", { name: "Search players" }), {
    target: { value: "no-such-player" },
  });
  expect(screen.getByRole("heading", { name: "No players found" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("button", { name: /12\s*Noah Martinez/ })).toBeTruthy();
});

it("opens the real assistant sign-in gate instead of prepared guide replies", () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Coach’s assistant" }));
  expect(screen.getByRole("heading", { name: "Sign in for a little coaching help." })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Sign in to Diamond Live" }).getAttribute("href")).toBe("/sign-in");
  expect(screen.queryByText("Prototype guide · prepared answers")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close assistant" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("switches calendar weeks and keeps a sourced drill in the local practice draft", () => {
  open();
  navigate("Calendar");
  expect(screen.getByRole("heading", { name: "Saturday team practice" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(screen.getByText("No sample events in this week.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "This week" }));
  expect(screen.getByRole("heading", { name: "Saturday team practice" })).toBeTruthy();
  navigate("Library");
  fireEvent.click(
    screen.getByRole("button", { name: "Add Quiet glove grounders to practice draft" }),
  );
  expect(screen.getByText("8 minutes selected · local preview")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hitting" }));
  navigate("Coach Desk");
  navigate("Library");
  expect(screen.getByText("8 minutes selected · local preview")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove Quiet glove grounders" }));
  expect(screen.getByText("Add a few drills to sketch out your next session.")).toBeTruthy();
});

it("opens the same workspaces from all four clubhouse areas", () => {
  open();
  for (const [area, destination] of [
    ["Team dugout: open Players", "Players"],
    ["Batting cage: open Development", "Development"],
    ["Planning desk: open Calendar", "Calendar"],
    ["Equipment wall: open Library", "Library"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: area }));
    const nav = within(screen.getByRole("navigation", { name: "Clubhouse navigation" }));
    expect(nav.getByRole("button", { name: destination }).getAttribute("aria-current")).toBe(
      "page",
    );
    navigate("Coach Desk");
  }
});

it("opens Consult the Rules from the umpire, answers with sources, and returns focus on close", () => {
  open();
  const umpire = screen.getByRole("button", {
    name: "Umpire behind home plate: Consult the Rules",
  });
  umpire.focus();
  fireEvent.click(umpire);
  const chat = screen.getByRole("dialog", { name: "Consult the Rules" });
  expect(within(chat).getByRole("combobox", { name: "Division" }).value).toBe("Minor B");
  fireEvent.click(within(chat).getByRole("button", { name: "Pitching limits" }));
  const reference = within(chat).getByRole("link", { name: "2026 HVLL Bylaws · page 27" });
  expect(reference.getAttribute("href")).toContain("#page=27");
  expect(within(chat).getByText("Minor B · Section X.K")).toBeTruthy();
  const question = within(chat).getByRole("textbox", { name: "Ask a rules question" });
  fireEvent.change(question, { target: { value: "intergalactic robot substitution" } });
  fireEvent.click(within(chat).getByRole("button", { name: "Send rules question" }));
  expect(within(chat).getByText(/I couldn’t find a matching passage/)).toBeTruthy();
  fireEvent.click(within(chat).getByRole("button", { name: "Close rules chat" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(umpire);
});

it("saves and edits a reviewed source, matches it to a player lesson, and persists it across reloads", () => {
  const app = open();
  navigate("Library");
  fireEvent.click(screen.getByRole("button", { name: "Video links" }));
  fireEvent.click(screen.getByRole("button", { name: "Save video link" }));
  fireEvent.change(screen.getByLabelText("Video or post link"), {
    target: { value: "https://youtu.be/abcdefghijk?si=test" },
  });
  fireEvent.change(screen.getByLabelText("Resource title"), {
    target: { value: "Tee setup test resource" },
  });
  fireEvent.change(screen.getByLabelText("Creator / coach"), { target: { value: "Test coach" } });
  fireEvent.change(screen.getByLabelText("Coaching notes"), {
    target: { value: "Start with a balanced setup." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save to library" }));
  expect(JSON.parse(localStorage.getItem(RESOURCE_KEY))[0].reviewed).toBe(false);
  navigate("Development");
  fireEvent.click(screen.getByRole("button", { name: /4\s*Mason Brooks/ }));
  expect(screen.getByText("Needs coach review in the Library before attaching.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add to lesson" })).toBeNull();
  navigate("Library");
  fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
  fireEvent.click(screen.getByLabelText("I watched this and reviewed its fit for our players."));
  fireEvent.click(screen.getByRole("button", { name: "Save to library" }));
  navigate("Development");
  fireEvent.click(screen.getByRole("button", { name: "Add to lesson" }));
  expect(screen.getByText("1 reviewed video attached to Mason’s lesson.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Approve practice proposal" }));
  expect(screen.getByRole("button", { name: "Remove from lesson" }).disabled).toBe(true);
  app.unmount();
  open();
  navigate("Library");
  fireEvent.click(screen.getByRole("button", { name: "Video links" }));
  expect(
    screen.getByRole("button", { name: "Open lesson for Tee setup test resource" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save video link" }));
  fireEvent.change(screen.getByLabelText("Video or post link"), {
    target: { value: "https://www.youtube.com/shorts/abcdefghijk" },
  });
  fireEvent.change(screen.getByLabelText("Resource title"), { target: { value: "Duplicate" } });
  fireEvent.click(screen.getByRole("button", { name: "Save to library" }));
  expect(screen.getByRole("alert").textContent).toContain("already in your library");
  fireEvent.click(screen.getByRole("button", { name: "Close save video" }));
  fireEvent.click(screen.getByRole("button", { name: "Open lesson for Tee setup test resource" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
  expect(JSON.parse(localStorage.getItem(RESOURCE_KEY))).toEqual([]);
}, 60000);

it("steps through a drill demonstration and offers playback", () => {
  open();
  navigate("Library");
  fireEvent.click(screen.getByRole("button", { name: "View Balanced tee swings" }));
  const detail = screen.getByRole("complementary");
  expect(
    within(detail).getByRole("img", { name: "Balanced tee swings: Balanced stance" }),
  ).toBeTruthy();
  fireEvent.click(within(detail).getByRole("button", { name: "Next demonstration step" }));
  expect(
    within(detail).getByRole("img", { name: "Balanced tee swings: Controlled swing" }),
  ).toBeTruthy();
  fireEvent.click(within(detail).getByRole("button", { name: "Play demonstration" }));
  expect(within(detail).getByRole("button", { name: "Pause demonstration" })).toBeTruthy();
  fireEvent.click(within(detail).getByRole("button", { name: "Pause demonstration" }));
});

it("records partial ratings, retains earlier skills, connects Development, and survives a reload", () => {
  const app = open();
  navigate("Players");
  fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Save assessment" }).disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Observed on"), {
    target: { value: "2026-10-19" },
  });
  fireEvent.change(within(dialog).getByLabelText("Coach name"), {
    target: { value: "Coach Taylor" },
  });
  fireEvent.click(within(dialog).getByRole("radio", { name: "Fielding 7 out of 10" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Baserunning 5 out of 10" }));
  fireEvent.change(within(dialog).getByLabelText("What did you observe?"), {
    target: { value: "Set feet on seven of ten throws; rounded first under control." },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save assessment" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("Fielding: 7 out of 10")).toBeTruthy();
  expect(screen.getByLabelText("Hitting: 6 out of 10").textContent).toContain("Sample baseline");
  expect(screen.getByLabelText("Baserunning: 5 out of 10")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(ASSESSMENT_KEY)).records).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Review development plan" }));
  expect(screen.getByText("Fielding · 7/10")).toBeTruthy();
  expect(screen.getByText("Coach Taylor")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Update ratings in Players" }));
  expect(screen.getByRole("heading", { name: "Noah Martinez" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));
  expect(screen.getByRole("radio", { name: "Fielding not observed today" }).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(JSON.parse(localStorage.getItem(ASSESSMENT_KEY)).records).toHaveLength(1);
  app.unmount();
  open();
  navigate("Players");
  expect(screen.getByLabelText("Fielding: 7 out of 10")).toBeTruthy();
  fireEvent.click(screen.getByText("Assessment history"));
  expect(screen.getByText("1 recorded + sample baseline")).toBeTruthy();
});

it("labels unsaved assessment storage honestly and keeps it usable in the session", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  open();
  navigate("Players");
  fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));
  fireEvent.change(screen.getByLabelText("Coach name"), { target: { value: "Test coach" } });
  fireEvent.click(screen.getByRole("radio", { name: "Hitting 8 out of 10" }));
  fireEvent.change(screen.getByLabelText("What did you observe?"), {
    target: { value: "Repeated balanced tee swings." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  expect(screen.getByRole("status").textContent).toContain("will not survive a reload");
  expect(screen.getByLabelText("Hitting: 8 out of 10")).toBeTruthy();
});
