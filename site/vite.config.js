import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built site works when served from a GitHub Pages
// project subpath (https://<user>.github.io/<repo>/) without hardcoding the
// repo name here.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
