import { existsSync } from 'node:fs';
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { readCloudConfig } from "./src/cloudConfig.js";
import { resolveBase } from "./src/base.js";
import { copyIndexTo404 } from "./src/spaFallback.js";

export default defineConfig(({ command, mode }) => {
  if (existsSync('.assistant-local/runtime.env')) process.loadEnvFile('.assistant-local/runtime.env');
  const cloud = readCloudConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  // Stop before Vite embeds public environment values in a browser bundle.
  if (cloud.error) throw new Error('Invalid public Supabase configuration. Use a project HTTPS URL and publishable key; never a server secret.');
  return ({
  base: resolveBase({ command, env: process.env }),
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/assistant': { target: 'http://127.0.0.1:8788', configure(proxy) { proxy.on('proxyReq', (proxyReq) => { if (process.env.DIAMOND_LOCAL_TOKEN && !proxyReq.getHeader('authorization')) proxyReq.setHeader('x-diamond-local-token', process.env.DIAMOND_LOCAL_TOKEN); }); } } } },
  build: {
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'account-service', test: /node_modules\/@supabase\// }] } } },
  },
  plugins: [
    react(),
    {
      name: "spa-404-fallback",
      writeBundle() {
        copyIndexTo404(resolve("dist"));
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.mjs"],
  },
});
});
