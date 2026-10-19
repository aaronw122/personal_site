import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ogPrerender } from "./vite-plugin-og";
import { syncWritingImages } from "./vite-plugin-writing-images";
import { rssFeed } from "./vite-plugin-rss";

const VAULT = "/Users/aaron/Documents/Obsidian_AW";
const WRITING = `${VAULT}/published/writing`;
const LISTS = `${VAULT}/published/lists`;
const ERA = `${VAULT}/networking/companies`;

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    syncWritingImages({
      sourceDirs: [WRITING, LISTS],
      sourceFiles: [`${ERA}/era/era devices 2.md`],
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
    rssFeed({ siteUrl: "https://awill.co", urlPrefix: "writing", dir: WRITING }),
  ],
  resolve: {
    alias: {
      "@writing": WRITING,
      "@lists": LISTS,
      "@era-content": ERA,
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
