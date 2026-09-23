import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import {
  deriveDescription,
  extractFrontmatter,
  htmlEscape,
  processMarkdown,
  stripFrontmatter,
} from "./vault-markdown";

// RSS 2.0 feed for the writing section with full post bodies, emitted at
// dist/rss.xml on build (nginx serves it via `try_files $uri`) and served
// live at /rss.xml by the dev server.
//
// The item set is the curated writing/index.md — the same [[wikilinks]] that
// drive the /writing landing page — so unlisted drafts sitting in the vault
// folder never leak into the feed. Items are ordered newest-first by the
// post's `creation_date` frontmatter (authored date), falling back to the
// file's birthtime when it's missing or unparseable.
//
// Bodies go through the same remark/rehype plugins ContentArticle uses, with
// two feed-specific choices: every URL is absolute (readers render off-site),
// and math is emitted as MathML only — KaTeX's HTML output needs its
// stylesheet, which readers don't load, so it would render twice and garbled.

const FEED_FILE = "rss.xml";

interface Options {
  siteUrl: string; // e.g. "https://awill.co" (no trailing slash)
  urlPrefix: string; // URL segment for the section, e.g. "writing"
  dir: string; // vault directory holding index.md and the posts
}

interface Item {
  title: string;
  url: string;
  date: Date;
  description: string;
  html: string;
}

const markdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex, { output: "mathml" })
  .use(rehypeStringify);

async function renderHtml(body: string, opts: Options): Promise<string> {
  const md = processMarkdown(body, opts.urlPrefix, opts.siteUrl);
  const html = String(await markdown.process(md));
  // Anything still site-relative (hand-written [x](/foo) links) → absolute.
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${opts.siteUrl}/`);
}

async function readItems(opts: Options, indexBody: string): Promise<Item[]> {
  const items: Item[] = [];
  // [[target]] or [[target|alias]] — the target is the source filename.
  for (const match of indexBody.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const slug = match[1].split("|")[0].trim();
    const file = path.join(opts.dir, `${slug}.md`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf8");
    const fm = extractFrontmatter(raw);
    const title = fm.title || slug;
    let date = new Date(fm.creation_date ?? NaN);
    if (Number.isNaN(date.getTime())) date = fs.statSync(file).birthtime;
    items.push({
      title,
      url: `${opts.siteUrl}/${opts.urlPrefix}/${encodeURIComponent(slug)}`,
      date,
      description: deriveDescription(raw, title),
      html: await renderHtml(stripFrontmatter(raw), opts),
    });
  }
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// CDATA can hold any markup verbatim except its own terminator, and XML still
// forbids the C0 control characters even inside CDATA.
function cdata(s: string): string {
  return `<![CDATA[${s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function buildXml(
  channel: { title: string; link: string; description: string; self: string },
  items: Item[],
): string {
  const entries = items
    .map(
      (it) => `    <item>
      <title>${htmlEscape(it.title)}</title>
      <link>${htmlEscape(it.url)}</link>
      <guid>${htmlEscape(it.url)}</guid>
      <pubDate>${it.date.toUTCString()}</pubDate>
      <description>${htmlEscape(it.description)}</description>
      <content:encoded>${cdata(it.html)}</content:encoded>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${htmlEscape(channel.title)}</title>
    <link>${htmlEscape(channel.link)}</link>
    <description>${htmlEscape(channel.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${htmlEscape(channel.self)}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;
}

async function generateFeed(
  opts: Options,
): Promise<{ xml: string; count: number } | null> {
  const indexPath = path.join(opts.dir, "index.md");
  if (!fs.existsSync(indexPath)) return null;
  const indexRaw = fs.readFileSync(indexPath, "utf8");
  const indexFm = extractFrontmatter(indexRaw);
  const title = indexFm.title || opts.urlPrefix;

  const items = await readItems(opts, stripFrontmatter(indexRaw));
  const xml = buildXml(
    {
      title: `${title} | awill.co`,
      link: `${opts.siteUrl}/${opts.urlPrefix}`,
      description: deriveDescription(indexRaw, title),
      self: `${opts.siteUrl}/${FEED_FILE}`,
    },
    items,
  );
  return { xml, count: items.length };
}

export function rssFeed(opts: Options): Plugin {
  return {
    name: "rss-feed",
    // Dev: regenerate on every request so vault edits show up without a restart.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== `/${FEED_FILE}`) return next();
        generateFeed(opts).then((feed) => {
          if (!feed) return next();
          res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
          res.end(feed.xml);
        }, next);
      });
    },
    async closeBundle() {
      const feed = await generateFeed(opts);
      if (!feed) return;
      fs.writeFileSync(path.join(path.resolve("dist"), FEED_FILE), feed.xml);
      // eslint-disable-next-line no-console
      console.log(`[rss-feed] wrote ${feed.count} items to dist/${FEED_FILE}`);
    },
  };
}
