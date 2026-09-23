import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyIndexTo404 } from "./spaFallback.js";

describe("SPA fallback", () => {
  it("copies index.html to 404.html", () => {
    const dir = mkdtempSync(join(tmpdir(), "diamond-live-"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Diamond Live</title>");
    copyIndexTo404(dir);
    expect(readFileSync(join(dir, "404.html"), "utf8")).toContain("Diamond Live");
  });
});
