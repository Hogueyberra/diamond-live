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
