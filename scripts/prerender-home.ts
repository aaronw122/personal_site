import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const indexPath = path.join(distDir, "index.html");
const rootTag = '<div id="root"></div>';

const template = fs.readFileSync(indexPath, "utf8");
if (!template.includes(rootTag)) {
  throw new Error(`[prerender-home] ${rootTag} not found in ${indexPath}`);
}

const { render } = await import(
  pathToFileURL(path.join(ssrDir, "entry-server.js")).href
);

fs.writeFileSync(path.join(distDir, "spa.html"), template);
fs.writeFileSync(
  indexPath,
  template.replace(rootTag, `<div id="root">${render("/")}</div>`),
);
fs.rmSync(ssrDir, { recursive: true, force: true });

console.log("[prerender-home] wrote dist/index.html and dist/spa.html");
