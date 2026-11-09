import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  deriveDescription,
  extractFrontmatter,
  htmlEscape,
} from "./vault-markdown";

interface Section {
  urlPrefix: string;
  dir: string;
}

interface FixedRoute {
  route: string;
  dir: string;
  slug: string;
}

interface Options {
  sections: Section[];
  fixed?: FixedRoute[];
  siteUrl: string;
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

      console.log(`\n[og-prerender] wrote ${count} social-preview pages`);
    },
  };
}
