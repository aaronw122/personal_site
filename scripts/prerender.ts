import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type * as EntryServer from "../src/entry-server";

const distDir = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const manifestDir = path.join(distDir, ".vite");
const indexPath = path.join(distDir, "index.html");
const rootTag = '<div id="root"></div>';
const stylesheetTag = /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/;
const entryScriptTag = '<script type="module" crossorigin src=';

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
}

const manifest: Record<string, ManifestChunk> = JSON.parse(
  fs.readFileSync(path.join(manifestDir, "manifest.json"), "utf8"),
);

function cssFor(key: string, seen = new Set<string>()): string[] {
  if (seen.has(key)) return [];
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) throw new Error(`[prerender] ${key} missing from vite manifest`);
  return [
    ...(chunk.css ?? []),
    ...(chunk.imports ?? []).flatMap((imported) => cssFor(imported, seen)),
  ];
}

const built = fs.readFileSync(indexPath, "utf8");
if (!built.includes(rootTag)) {
  throw new Error(`[prerender] ${rootTag} not found in ${indexPath}`);
}
if (!built.includes(entryScriptTag)) {
  throw new Error(`[prerender] entry <script> not found in ${indexPath}`);
}
const stylesheet = built.match(stylesheetTag);
if (!stylesheet) {
  throw new Error(`[prerender] stylesheet <link> not found in ${indexPath}`);
}
const css = fs.readFileSync(path.join(distDir, stylesheet[1]), "utf8");
const template = built.replace(stylesheetTag, () => `<style>${css}</style>`);

const { render, FIXED_ARTICLES }: typeof EntryServer = await import(
  pathToFileURL(path.join(ssrDir, "entry-server.js")).href
);

fs.writeFileSync(path.join(distDir, "spa.html"), template);
fs.writeFileSync(
  indexPath,
  template
    .replace(entryScriptTag, '<script type="module" fetchpriority="low" crossorigin src=')
    .replace(rootTag, `<div id="root">${await render("/")}</div>`),
);

const articleCss = cssFor("src/pages/ContentArticle.tsx");
const indexCss = cssFor("src/pages/ContentIndex.tsx");
const mathCss = cssFor("src/lib/katexPlugin.ts");
const highlightCss = cssFor("src/lib/highlightPlugin.ts");

const pages: { file: string; url: string; css: string[] }[] = [];
for (const section of ["writing", "lists"]) {
  const sectionDir = path.join(distDir, section);
  pages.push({ file: path.join(sectionDir, "index.html"), url: `/${section}`, css: indexCss });
  for (const slug of fs.readdirSync(sectionDir)) {
    const file = path.join(sectionDir, slug, "index.html");
    if (!fs.existsSync(file)) continue;
    pages.push({ file, url: `/${section}/${encodeURIComponent(slug)}`, css: articleCss });
  }
}
for (const fixed of FIXED_ARTICLES) {
  pages.push({ file: path.join(distDir, fixed.path, "index.html"), url: fixed.path, css: articleCss });
}

const readCss = (file: string) => fs.readFileSync(path.join(distDir, file), "utf8");

for (const page of pages) {
  const shell = fs.readFileSync(page.file, "utf8");
  if (!shell.includes(rootTag) || !stylesheetTag.test(shell)) {
    throw new Error(`[prerender] ${rootTag} or stylesheet <link> not found in ${page.file}`);
  }
  const markup = await render(page.url);
  const inlined = [...new Set(page.css)].filter((file) => `/${file}` !== stylesheet[1]);
  const linked = [
    ...(markup.includes('class="katex') ? mathCss : []),
    ...(markup.includes('class="hljs') ? highlightCss : []),
  ];
  const styles = `<style>${css}${inlined.map(readCss).join("")}</style>`;
  const links = [...new Set(linked)]
    .map((file) => `<link rel="stylesheet" crossorigin href="/${file}">`)
    .join("");
  fs.writeFileSync(
    page.file,
    shell
      .replace(stylesheetTag, () => styles + links)
      .replace(rootTag, () => `<div id="root">${markup}</div>`),
  );
}

fs.rmSync(ssrDir, { recursive: true, force: true });
fs.rmSync(manifestDir, { recursive: true, force: true });

console.log(`[prerender] wrote dist/index.html, dist/spa.html and ${pages.length} content pages`);
