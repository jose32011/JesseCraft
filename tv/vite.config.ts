import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app is served by the arcade at /prime-upcoming/, so production asset URLs
// must include that prefix even when `vite build` runs without --base.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/prime-upcoming/" : "/",
}));
