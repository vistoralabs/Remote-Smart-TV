// Standalone static build used only for the native Android (Capacitor) wrapper.
// The deployed web app still builds from vite.config.ts / TanStack Start.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "mobile"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "mobile-dist"),
    emptyOutDir: true,
  },
});
