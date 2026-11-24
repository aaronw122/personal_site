import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  deriveDescription,
  extractFrontmatter,
  htmlEscape,
} from "./vault-markdown";
import { urlSlug } from "./src/lib/slug";

interface Section {
  urlPrefix: string;
  dir: string;
}

interface FixedRoute {
  route: string;
  dir: string;
  slug: string;
}

interface StaticPage {
  route: string;
  title: string;
  description: string;
  image: string;
}

interface Options {
  sections: Section[];
  fixed?: FixedRoute[];
  pages?: StaticPage[];
  siteUrl: string;
  sitemapRoutes?: string[];
}

interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  published?: string;
}

function articleJsonLd(meta: PageMeta): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.published,
    url: meta.url,
    mainEntityOfPage: meta.url,
    author: { "@type": "Person", name: "Aaron Williams", url: "https://awill.co/" },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function buildHtml(template: string, meta: PageMeta): string {
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

  if (meta.image) {
    html = html.replace(
      /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${htmlEscape(meta.image)}" />`,
    );
  }

  html = html.replace(
    /(<meta property="og:url"[^>]*>)/,
    `$1\n    <meta name="twitter:card" content="summary_large_image" />` +
      `\n    <meta name="twitter:title" content="${title}" />` +
      `\n    <meta name="twitter:description" content="${desc}" />`,
  );
  if (meta.published) {
    html = html.replace(
      "</head>",
      `  <script type="application/ld+json">${articleJsonLd(meta)}</script>\n  </head>`,
    );
  }
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

      const sitemap = new Set<string>([
        `${opts.siteUrl}/`,
        ...(opts.sitemapRoutes ?? []).map((route) => `${opts.siteUrl}/${route}`),
      ]);
      const fixedUrls = new Map(
        (opts.fixed ?? []).map((fixed) => [
          path.join(fixed.dir, `${fixed.slug}.md`),
          `${opts.siteUrl}/${fixed.route}`,
        ]),
      );

      const write = (relPath: string, meta: PageMeta) => {
        const outDir = path.join(distDir, relPath);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, "index.html"), buildHtml(template, meta));
        sitemap.add(meta.url);
      };

      const emit = (relPath: string, sourceFile: string, url: string, isArticle: boolean) => {
        const raw = fs.readFileSync(sourceFile, "utf8");
        const fm = extractFrontmatter(raw);
        const slugTitle = path.basename(sourceFile).replace(/\.md$/, "");
        const title = fm.title || slugTitle;
        const description =
          fm.description ||
          deriveDescription(raw, "aspiring renaissance man. building at fractal.");
        const published = isArticle ? fm.creation_date : undefined;
        write(relPath, { title, description, url, published });
      };

      let count = 0;

      for (const section of opts.sections) {
        if (!fs.existsSync(section.dir)) continue;
        const sectionIndex = path.join(section.dir, "index.md");
        if (fs.existsSync(sectionIndex)) {
          emit(section.urlPrefix, sectionIndex, `${opts.siteUrl}/${section.urlPrefix}`, false);
          count++;
        }
        for (const file of fs.readdirSync(section.dir)) {
          if (!file.endsWith(".md") || file === "index.md") continue;
          const name = file.replace(/\.md$/, "");
          const slug = urlSlug(name);
          const sourceFile = path.join(section.dir, file);
          const url =
            fixedUrls.get(sourceFile) ?? `${opts.siteUrl}/${section.urlPrefix}/${slug}`;
          emit(path.join(section.urlPrefix, slug), sourceFile, url, true);
          count++;
          if (name !== slug) {
            emit(path.join(section.urlPrefix, name), sourceFile, url, true);
            count++;
          }
        }
      }

      for (const fixed of opts.fixed ?? []) {
        const sourceFile = path.join(fixed.dir, `${fixed.slug}.md`);
        if (!fs.existsSync(sourceFile)) continue;
        emit(fixed.route, sourceFile, `${opts.siteUrl}/${fixed.route}`, true);
        count++;
      }

      for (const page of opts.pages ?? []) {
        write(page.route, {
          title: page.title,
          description: page.description,
          url: `${opts.siteUrl}/${page.route}`,
          image: `${opts.siteUrl}${page.image}`,
        });
        count++;
      }

      const urls = [...sitemap]
        .map((url) => `  <url><loc>${htmlEscape(encodeURI(url))}</loc></url>`)
        .join("\n");
      fs.writeFileSync(
        path.join(distDir, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      );

      console.log(`\n[og-prerender] wrote ${count} social-preview pages`);
    },
  };
}
