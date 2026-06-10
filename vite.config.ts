import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@writing": "/Users/aaron/Documents/Obsidian_AW/published/writing",
      "@lists": "/Users/aaron/Documents/Obsidian_AW/published/lists",
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 4200,
    fs: {
      allow: [".", "/Users/aaron/Documents/Obsidian_AW"],
    },
  },
});
