import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const indexPath = path.join(distDir, "index.html");
const rootTag = '<div id="root"></div>';
const stylesheetTag = /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/;

const built = fs.readFileSync(indexPath, "utf8");
if (!built.includes(rootTag)) {
  throw new Error(`[prerender-home] ${rootTag} not found in ${indexPath}`);
}
const stylesheet = built.match(stylesheetTag);
if (!stylesheet) {
  throw new Error(`[prerender-home] stylesheet <link> not found in ${indexPath}`);
}
const css = fs.readFileSync(path.join(distDir, stylesheet[1]), "utf8");
const template = built.replace(stylesheetTag, () => `<style>${css}</style>`);

const { render } = await import(
  pathToFileURL(path.join(ssrDir, "entry-server.js")).href
);

const entryScriptTag = '<script type="module" crossorigin src=';
if (!template.includes(entryScriptTag)) {
  throw new Error(`[prerender-home] entry <script> not found in ${indexPath}`);
}

fs.writeFileSync(path.join(distDir, "spa.html"), template);
fs.writeFileSync(
  indexPath,
  template
    .replace(entryScriptTag, '<script type="module" fetchpriority="low" crossorigin src=')
    .replace(rootTag, () => `<div id="root">${render("/")}</div>`),
);
fs.rmSync(ssrDir, { recursive: true, force: true });

console.log("[prerender-home] wrote dist/index.html and dist/spa.html");
