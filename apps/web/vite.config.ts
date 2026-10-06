import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // VITE_API_URL lives in the repo root .env next to the API settings.
  envDir: "../..",
  server: { port: 5173 },
});
