import { describe, expect, it } from "vitest";
import { makeResource, parseVideoLink } from "./drillResources.js";

describe("video resource boundaries", () => {
  it("recognizes platforms and canonicalizes common YouTube links for duplicate detection", () => {
    const expected = "https://www.youtube.com/watch?v=abcdefghijk";
    for (const url of [
      "https://youtu.be/abcdefghijk?si=tracking",
      "https://www.youtube.com/shorts/abcdefghijk",
      "https://www.youtube.com/watch?v=abcdefghijk&utm_source=social",
    ])
      expect(parseVideoLink(url)).toEqual({ url: expected, platform: "YouTube" });
    expect(parseVideoLink("https://www.instagram.com/reel/example/?igsh=tracking").platform).toBe(
      "Instagram",
    );
    expect(parseVideoLink("https://www.tiktok.com/@coach/video/123").platform).toBe("TikTok");
    expect(parseVideoLink("https://youtube.com.example.org/clip").platform).toBe("Web");
  });
  it("rejects executable and credential-bearing links and unknown skill mappings", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "http://example.org/video",
      "https://user:pass@example.org/video",
      "not a link",
    ])
      expect(() => parseVideoLink(url)).toThrow();
    expect(() =>
      makeResource({ url: "https://example.org/clip", title: "Demo", drillId: "invented" }),
    ).toThrow();
    expect(() =>
      makeResource({ url: "https://example.org/clip", title: " ", drillId: "balanced-tee" }),
    ).toThrow();
  });
});
