import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@writing": "/Users/aaron/Documents/Obsidian_AW/Writing",
      "@lists": "/Users/aaron/Documents/Obsidian_AW/Lists",
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
