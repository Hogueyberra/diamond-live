export const PAGES_BASE = "/diamond-live/";

export function normalizeBase(value) {
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "/") return "/";
  let base = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

export function resolveBase({ command = "build", env = {} } = {}) {
  const fromEnv = env.VITE_BASE_PATH;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return normalizeBase(fromEnv);
  if (command === "serve") return "/";
  return PAGES_BASE;
}

export function routerBasename(baseUrl = "/") {
  if (!baseUrl || baseUrl === "/") return "/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

// Older bookmarks can retain the repository prefix after the website moves to
// its own domain. Return a root-relative path, never a protocol-relative URL.
export function legacyProjectPath(pathname) {
  const prefix = PAGES_BASE.slice(0, -1);
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  return `/${pathname.slice(prefix.length).replace(/^\/+/, "")}`;
}
