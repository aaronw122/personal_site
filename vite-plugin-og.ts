import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Build-time prerendering of per-post OG / social-preview metadata.
//
// The site is a client-rendered SPA, so link-preview bots (iMessage, Slack,
// Twitter, Discord…) that don't run JS only ever see the static index.html —
// which has the generic "aaron williams" OG tags. This plugin emits a physical
// HTML file per post at dist/<section>/<slug>/index.html, identical to
// index.html but with the OG/title/description/canonical tags swapped for the
// post's own. nginx's `try_files $uri/ /index.html` serves these to bots; real
// visitors still boot the full SPA (assets are absolute-pathed).

interface Section {
  // URL prefix and vault directory, e.g. { urlPrefix: "writing", dir: "…/writing" }
  urlPrefix: string;
  dir: string;
}

interface FixedRoute {
  // Standalone top-level routes (e.g. /oboe) that render a specific post.
  route: string; // URL path without leading slash, e.g. "haystack-errw-proof"
  dir: string; // vault directory to look in
  slug: string; // source filename without .md
}

interface Options {
  sections: Section[];
  fixed?: FixedRoute[];
  siteUrl: string; // e.g. "https://awill.co" (no trailing slash)
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val) result[key] = val;
  }
  return result;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
}

// Pull a plain-text summary from the first real paragraph of the body.
function deriveDescription(body: string, fallback: string): string {
  const lines = stripFrontmatter(body).split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // heading
    if (/^!?\[\[.*\]\]$/.test(line)) continue; // wikilink embed on its own
    if (/^!\[.*\]\(.*\)$/.test(line)) continue; // image on its own
    if (/^(---|\*\*\*|___)$/.test(line)) continue; // horizontal rule
    // Strip common markdown markup down to readable prose.
    let text = line
      .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t) // wikilinks
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
      .replace(/[*_`>#]/g, "") // emphasis / code / quote / heading marks
      .trim();
    if (!text) continue;
    if (text.length > 200) text = text.slice(0, 197).trimEnd() + "…";
    return text;
  }
  return fallback;
}

function buildHtml(
  template: string,
  meta: { title: string; description: string; url: string },
): string {
  const title = htmlEscape(meta.title);
  const desc = htmlEscape(meta.description);
  const url = htmlEscape(meta.url);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title} | awill.co</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${desc}" />`,
    )
    .replace(
      /<link rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${desc}" />`,
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${url}" />`,
    );

  // Add Twitter Card tags (index.html has none) right after og:url so
  // Twitter/X and other consumers get a title too.
  html = html.replace(
    /(<meta property="og:url"[^>]*>)/,
    `$1\n    <meta name="twitter:card" content="summary_large_image" />` +
      `\n    <meta name="twitter:title" content="${title}" />` +
      `\n    <meta name="twitter:description" content="${desc}" />`,
  );
  return html;
}

export function ogPrerender(opts: Options): Plugin {
  return {
    name: "og-prerender",
    apply: "build",
    closeBundle() {
      const distDir = path.resolve("dist");
      const templatePath = path.join(distDir, "index.html");
      if (!fs.existsSync(templatePath)) return;
      const template = fs.readFileSync(templatePath, "utf8");

      const emit = (relPath: string, sourceFile: string, url: string) => {
        const raw = fs.readFileSync(sourceFile, "utf8");
        const fm = extractFrontmatter(raw);
        const slugTitle = path.basename(sourceFile).replace(/\.md$/, "");
        const title = fm.title || slugTitle;
        const description = deriveDescription(
          raw,
          "aspiring renaissance man. building at fractal.",
        );
        const outDir = path.join(distDir, relPath);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(
          path.join(outDir, "index.html"),
          buildHtml(template, { title, description, url }),
        );
      };

      let count = 0;

      for (const section of opts.sections) {
        if (!fs.existsSync(section.dir)) continue;
        // Section landing page (e.g. /writing) from the curated index.md, so
        // link-preview bots get section-specific OG meta and a self-canonical
        // URL instead of the generic homepage tags. nginx serves this inline
        // via try_files $uri/index.html.
        const sectionIndex = path.join(section.dir, "index.md");
        if (fs.existsSync(sectionIndex)) {
          emit(section.urlPrefix, sectionIndex, `${opts.siteUrl}/${section.urlPrefix}`);
          count++;
        }
        for (const file of fs.readdirSync(section.dir)) {
          if (!file.endsWith(".md") || file === "index.md") continue;
          const slug = file.replace(/\.md$/, "");
          const url = `${opts.siteUrl}/${section.urlPrefix}/${encodeURIComponent(slug)}`;
          emit(
            path.join(section.urlPrefix, slug),
            path.join(section.dir, file),
            url,
          );
          count++;
        }
      }

      for (const fixed of opts.fixed ?? []) {
        const sourceFile = path.join(fixed.dir, `${fixed.slug}.md`);
        if (!fs.existsSync(sourceFile)) continue;
        emit(fixed.route, sourceFile, `${opts.siteUrl}/${fixed.route}`);
        count++;
      }

      // eslint-disable-next-line no-console
      console.log(`\n[og-prerender] wrote ${count} social-preview pages`);
    },
  };
}
