import { useEffect, useRef, useState } from "react";
import { PRACTICE_DRILLS } from "../practicePlanning.js";

export const RESOURCE_KEY = "diamond-live:prototype:video-library:v1";
export const categoryForDrill = (drill) =>
  !drill
    ? "Inbox"
    : drill.skillId.startsWith("hit_")
      ? "Hitting"
      : drill.skillId.startsWith("of_")
        ? "Outfield"
        : drill.skillId.startsWith("if_")
          ? "Infield"
          : "Throwing";

// Store links and coach-authored context, never downloaded media or inferred video content.
export function parseVideoLink(input) {
  if (input.length > 2000) throw new Error("Use a link of up to 2,000 characters.");
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Paste a complete HTTPS link.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes("."))
    throw new Error("Use a public HTTPS link without sign-in details.");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const belongs = (domain) => host === domain || host.endsWith(`.${domain}`);
  let platform =
    belongs("youtube.com") || host === "youtu.be"
      ? "YouTube"
      : belongs("instagram.com")
        ? "Instagram"
        : belongs("tiktok.com")
          ? "TikTok"
          : belongs("vimeo.com")
            ? "Vimeo"
            : belongs("facebook.com") || host === "fb.watch"
              ? "Facebook"
              : "Web";
  if (platform === "YouTube") {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1).split("/")[0]
        : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) url = new URL(`https://www.youtube.com/watch?v=${id}`);
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|igsh$|si$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return { url: url.href, platform };
}

export function makeResource(input) {
  const drill = PRACTICE_DRILLS.find((item) => item.id === input.drillId);
  if (!drill && input.drillId !== "") throw new Error("Choose the skill this video helps teach.");
  const title = String(input.title || "").trim();
  if (!title || title.length > 120) throw new Error("Give this link a title of 1–120 characters.");
  return {
    id: typeof input.id === "string" ? input.id : crypto.randomUUID(),
    ...parseVideoLink(String(input.url || "")),
    title,
    drillId: drill?.id || "",
    creator: String(input.creator || "")
      .trim()
      .slice(0, 100),
    notes: String(input.notes || "")
      .trim()
      .slice(0, 1500),
    reviewed: Boolean(drill) && input.reviewed === true,
  };
}

function loadLibrary() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RESOURCE_KEY) || "[]");
    const seen = new Set();
    const resources = (Array.isArray(raw) ? raw : []).slice(0, 200).flatMap((entry) => {
      try {
        const item = makeResource(entry);
        if (seen.has(item.url)) return [];
        seen.add(item.url);
        return [item];
      } catch {
        return [];
      }
    });
    return { resources, persistent: true };
  } catch {
    return { resources: [], persistent: false };
  }
}

export function useVideoLibrary() {
  const [state, setState] = useState(loadLibrary);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    const sync = (event) => {
      if (event.key !== RESOURCE_KEY && event.key !== null) return;
      // A failed write is kept in this tab until it can be saved again.
      if (!current.current.persistent) return;
      const next = loadLibrary();
      current.current = next;
      setState(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const latestResources = () => {
    if (!current.current.persistent) return current.current.resources;
    const disk = loadLibrary();
    return disk.persistent ? disk.resources : current.current.resources;
  };
  const write = (resources) => {
    let persistent = true;
    try {
      window.localStorage.setItem(RESOURCE_KEY, JSON.stringify(resources));
    } catch {
      persistent = false;
    }
    current.current = { resources, persistent };
    setState(current.current);
    return persistent;
  };
  return {
    ...state,
    save(input) {
      const item = makeResource(input);
      const resources = latestResources();
      if (resources.some((r) => r.url === item.url && r.id !== item.id))
        throw new Error(
          "That link is already in your library. Open it to edit the coaching notes.",
        );
      if (!resources.some((r) => r.id === item.id) && resources.length >= 200)
        throw new Error("This prototype holds up to 200 links. Remove an unused link first.");
      write([item, ...resources.filter((r) => r.id !== item.id)]);
      return item;
    },
    capture(url, title = "") {
      const link = parseVideoLink(url);
      const resources = latestResources();
      const existing = resources.find((item) => item.url === link.url);
      if (existing) {
        current.current = { ...current.current, resources };
        setState(current.current);
        return { item: existing, duplicate: true, persistent: current.current.persistent };
      }
      if (resources.length >= 200)
        throw new Error(
          "Your prototype library is full. Remove an unused link before saving another.",
        );
      const item = makeResource({
        ...link,
        title: title.trim().slice(0, 120) || `${link.platform} link`,
        drillId: "",
        reviewed: false,
      });
      const persistent = write([item, ...resources]);
      return { item, duplicate: false, persistent };
    },
    remove(id) {
      write(latestResources().filter((item) => item.id !== id));
    },
  };
}
