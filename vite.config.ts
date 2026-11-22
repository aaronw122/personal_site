import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ogPrerender } from "./vite-plugin-og";
import { syncWritingImages } from "./vite-plugin-writing-images";
import { rssFeed } from "./vite-plugin-rss";
import { tweets } from "./vite-plugin-tweets";
import { show } from "./src/data/podcast";
import { FIXED_ARTICLES } from "./src/data/fixedArticles";

const VAULT = "/Users/aaron/Documents/Obsidian_AW";
const WRITING = `${VAULT}/published/writing`;
const LISTS = `${VAULT}/published/lists`;
const ERA = `${VAULT}/networking/companies`;

export default defineConfig(({ isSsrBuild }) => ({
  base: "/",
  plugins: [
    react(),
    tweets({ sourceDirs: [WRITING, LISTS], snapshot: "src/data/tweets.json" }),
    !isSsrBuild && [
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
        fixed: FIXED_ARTICLES.map(({ path, slug }) => ({ route: path.slice(1), dir: WRITING, slug })),
        pages: [
          { route: "podcast", title: show.title, description: show.description, image: "/images/no-agendas.jpg" },
        ],
      }),
      rssFeed({ siteUrl: "https://awill.co", urlPrefix: "writing", dir: WRITING }),
    ],
  ],
  define: {
    __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
  },
  resolve: {
    alias: {
      "@writing": WRITING,
      "@lists": LISTS,
      "@era-content": ERA,
    },
  },
  build: {
    outDir: "dist",
    manifest: !isSsrBuild,
  },
  server: {
    port: 4200,
    fs: {
      allow: [".", VAULT],
    },
  },
}));
