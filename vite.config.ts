import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ogPrerender } from "./vite-plugin-og";
import { syncWritingImages } from "./vite-plugin-writing-images";

const VAULT = "/Users/aaron/Documents/Obsidian_AW";
const WRITING = `${VAULT}/published/writing`;
const LISTS = `${VAULT}/published/lists`;

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    syncWritingImages({
      sourceDirs: [WRITING, LISTS],
      attachmentsDirs: [`${VAULT}/Code/Images 1`],
      destDir: "public/writing-images",
    }),
    ogPrerender({
      siteUrl: "https://awill.co",
      sections: [
        { urlPrefix: "writing", dir: WRITING },
        { urlPrefix: "lists", dir: LISTS },
      ],
      // Standalone top-level routes declared in App.tsx.
      fixed: [
        { route: "haystack-errw-proof", dir: WRITING, slug: "haystack-errw-proof" },
        { route: "oboe", dir: WRITING, slug: "most inneficient way to find needle in a haystack" },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@writing": WRITING,
      "@lists": LISTS,
      "@era-content": `${VAULT}/networking/companies`,
      "@era-images": `${VAULT}/Code/Images 1`,
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 4200,
    fs: {
      allow: [".", VAULT],
    },
  },
});
