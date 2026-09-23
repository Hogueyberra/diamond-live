import { copyFileSync } from "node:fs";
import { join } from "node:path";

export function copyIndexTo404(distDir, fsImpl = { copyFileSync }) {
  fsImpl.copyFileSync(join(distDir, "index.html"), join(distDir, "404.html"));
}
