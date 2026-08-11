import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RemoteApp } from "@/components/remote/RemoteApp";
import { Toaster } from "@/components/ui/sonner";
import { loadSettings } from "@/lib/settings";
import { applyTheme } from "@/lib/theme";
import "@/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing");

// Apply the stored theme synchronously, before the first React render, so the
// app never flashes the bootstrap palette and never settles late.
try {
  const settings = loadSettings();
  applyTheme(settings.skin, settings.appearance, settings.keyStyle);
} catch {
  /* keep booting with the bootstrap palette */
}

try {
  createRoot(container).render(
    <StrictMode>
      <RemoteApp />
      <Toaster position="top-center" />
    </StrictMode>,
  );
  document.documentElement.dataset.appMounted = "true";
  document.getElementById("startup-fallback")?.remove();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  container.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center"><div><h1 style="font-size:20px">Smart TV Remote</h1><p style="opacity:.7">The app could not start.</p><pre style="white-space:pre-wrap;font-size:12px">${message.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[character] ?? character)}</pre></div></main>`;
  document.getElementById("startup-fallback")?.remove();
}
