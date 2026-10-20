import { parseVideoLink } from "./drillResources.js";

// Shortcuts can append a shared URL verbatim as the fragment. Inner query
// parameters stay intact, and the source URL is not sent to the web host.
export function readSharedLink({ hash = "", search = "" }) {
  const fragment = hash.replace(/^#/, "");
  const params = new URLSearchParams(search);
  let text = fragment || params.get("url") || params.get("text") || "";
  if (/^(url|text)=/.test(fragment)) {
    const fields = new URLSearchParams(fragment);
    text = fields.get("url") || fields.get("text") || "";
  } else if (/^https%3a/i.test(fragment)) {
    try {
      text = decodeURIComponent(fragment);
    } catch {
      /* Show the original input for repair. */
    }
  }
  if (text.length > 6000)
    throw new Error("That shared text is too long. Share just the video or post link.");
  const candidates = text.trim().match(/https:\/\/[^\s<>"“”]+/gi) || [];
  const links = [...new Set(candidates)];
  if (links.length > 1)
    throw new Error("Share one video at a time, or paste the link you want to keep.");
  const url = (links[0] || text).trim();
  if (!url) return { url: "", title: "" };
  parseVideoLink(url);
  return { url, title: (params.get("title") || "").trim().slice(0, 120) };
}

export function capturePrefix(prototypeUrl) {
  const url = new URL(prototypeUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Enter the address of your Diamond Live prototype.");
  url.search = "?capture=1";
  url.hash = "";
  return `${url.href}#`;
}
