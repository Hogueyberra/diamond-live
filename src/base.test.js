import { describe, expect, it } from "vitest";
import { normalizeBase, resolveBase, routerBasename, PAGES_BASE } from "./base.js";

describe("base path", () => {
  it("uses the site root for local dev and the Pages path for builds", () => {
    expect(resolveBase({ command: "serve" })).toBe("/");
    expect(resolveBase({ command: "build" })).toBe(PAGES_BASE);
    expect(PAGES_BASE).toBe("/diamond-live/");
  });

  it("lets VITE_BASE_PATH override both", () => {
    expect(resolveBase({ command: "serve", env: { VITE_BASE_PATH: "/preview/" } })).toBe("/preview/");
    expect(resolveBase({ command: "build", env: { VITE_BASE_PATH: "diamond-live" } })).toBe("/diamond-live/");
    expect(normalizeBase("/")).toBe("/");
  });

  it("strips the trailing slash for the router basename", () => {
    expect(routerBasename("/")).toBe("/");
    expect(routerBasename("/diamond-live/")).toBe("/diamond-live");
    expect(routerBasename("/diamond-live")).toBe("/diamond-live");
  });
});
