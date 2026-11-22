import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  root: mode === "demo" ? fileURLToPath(new URL("./demo", import.meta.url)) : undefined,
  base: mode === "demo" ? "/instaRJify/" : "/",
  build: mode === "demo" ? { outDir: "../dist-demo", emptyOutDir: true } : undefined,
  plugins: [react()],
  publicDir: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3000", "/health": "http://127.0.0.1:3000" },
  },
}));
