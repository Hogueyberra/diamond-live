import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolveBase } from "./src/base.js";
import { copyIndexTo404 } from "./src/spaFallback.js";

export default defineConfig(({ command }) => ({
  base: resolveBase({ command, env: process.env }),
  plugins: [
    react(),
    {
      name: "spa-404-fallback",
      closeBundle() {
        copyIndexTo404(resolve("dist"));
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
}));
