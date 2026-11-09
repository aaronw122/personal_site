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

const FEED_FILE = "rss.xml";

interface Options {
  siteUrl: string;
  urlPrefix: string;
  dir: string;
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
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${opts.siteUrl}/`);
}

async function readItems(opts: Options, indexBody: string): Promise<Item[]> {
  const items: Item[] = [];
  for (const match of indexBody.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const slug = match[1].split("|")[0].trim().split("/").pop()!.trim();
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
      console.log(`[rss-feed] wrote ${feed.count} items to dist/${FEED_FILE}`);
    },
  };
}
