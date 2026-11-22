import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { tweetId, type Tweet, type TweetMedia, type TweetQuote, type TweetSegment } from "./src/lib/tweet";

interface Options {
  sourceDirs: string[];
  snapshot: string;
}

interface RawEntity {
  indices: [number, number];
}

interface RawTweet {
  id_str: string;
  text: string;
  display_text_range: [number, number];
  entities: {
    urls?: (RawEntity & { url: string; expanded_url: string; display_url: string })[];
    user_mentions?: (RawEntity & { screen_name: string })[];
    hashtags?: (RawEntity & { text: string })[];
  };
  created_at: string;
  user: {
    name: string;
    screen_name: string;
    profile_image_url_https: string;
    is_blue_verified?: boolean;
  };
  favorite_count?: number;
  conversation_count?: number;
  mediaDetails?: {
    type: TweetMedia["type"];
    media_url_https: string;
    original_info: { width: number; height: number };
  }[];
  quoted_tweet?: RawTweet;
}

interface TweetRef {
  id: string;
  url: string;
  file: string;
}

const VIRTUAL_ID = "virtual:tweets";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const BLOCK = /^(```|~~~)tweet[^\S\n]*\n([\s\S]*?)^\1/gm;

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const TIME_FORMAT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function segments(raw: RawTweet): TweetSegment[] {
  const chars = Array.from(raw.text);
  const [start, end] = raw.display_text_range;
  const links = [
    ...(raw.entities.urls ?? []).map((e) => ({ indices: e.indices, text: e.display_url, href: e.expanded_url })),
    ...(raw.entities.user_mentions ?? []).map((e) => ({
      indices: e.indices,
      text: `@${e.screen_name}`,
      href: `https://x.com/${e.screen_name}`,
    })),
    ...(raw.entities.hashtags ?? []).map((e) => ({
      indices: e.indices,
      text: `#${e.text}`,
      href: `https://x.com/hashtag/${encodeURIComponent(e.text)}`,
    })),
  ]
    .filter(({ indices: [a, b] }) => a >= start && b <= end)
    .sort((a, b) => a.indices[0] - b.indices[0]);

  const out: TweetSegment[] = [];
  let cursor = start;
  for (const link of links) {
    if (link.indices[0] < cursor) continue;
    if (link.indices[0] > cursor) out.push({ text: decodeEntities(chars.slice(cursor, link.indices[0]).join("")) });
    out.push({ text: link.text, href: link.href });
    cursor = link.indices[1];
  }
  if (cursor < end) out.push({ text: decodeEntities(chars.slice(cursor, end).join("")) });
  return out;
}

function quote(raw: RawTweet): TweetQuote {
  return {
    url: `https://x.com/${raw.user.screen_name}/status/${raw.id_str}`,
    name: raw.user.name,
    handle: raw.user.screen_name,
    avatar: raw.user.profile_image_url_https.replace("_normal", "_bigger"),
    verified: raw.user.is_blue_verified ?? false,
    segments: segments(raw),
    media: (raw.mediaDetails ?? []).map((m) => ({
      type: m.type,
      src: `${m.media_url_https}?name=large`,
      width: m.original_info.width,
      height: m.original_info.height,
    })),
  };
}

function tweet(raw: RawTweet): Tweet {
  const created = new Date(raw.created_at);
  return {
    ...quote(raw),
    date: `${TIME_FORMAT.format(created)} · ${DATE_FORMAT.format(created)}`,
    likes: raw.favorite_count ?? 0,
    replies: raw.conversation_count ?? 0,
    quote: raw.quoted_tweet && quote(raw.quoted_tweet),
  };
}

async function fetchTweet(id: string): Promise<Tweet> {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (!body) throw new Error("empty response (tweet deleted or protected?)");
  const raw: RawTweet = JSON.parse(body);
  if (!raw.id_str || !raw.user) throw new Error("response is not a tweet");
  return tweet(raw);
}

function scan(dirs: string[]): TweetRef[] {
  const refs: TweetRef[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const rel of fs.readdirSync(dir, { recursive: true, encoding: "utf8" })) {
      if (!rel.endsWith(".md")) continue;
      const file = path.join(dir, rel);
      for (const m of fs.readFileSync(file, "utf8").matchAll(BLOCK)) {
        const url = m[2].trim();
        const id = tweetId(url);
        if (!id) throw new Error(`[tweets] invalid tweet URL ${JSON.stringify(url)} in ${file}`);
        refs.push({ id, url, file });
      }
    }
  }
  return refs;
}

function readSnapshot(file: string): Record<string, Tweet> {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

export function tweets(opts: Options): Plugin {
  return {
    name: "tweets",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      const refs = new Map(scan(opts.sourceDirs).map((ref) => [ref.id, ref]));
      const saved = readSnapshot(opts.snapshot);
      const missing = [...refs.values()].filter((ref) => !saved[ref.id]);
      const fetched = await Promise.all(
        missing.map(async ({ id: key, url, file }) => {
          try {
            const data = await fetchTweet(key);
            console.log(`[tweets] fetched ${url}`);
            return [key, data] as const;
          } catch (error) {
            throw new Error(
              `[tweets] failed to fetch ${url} (referenced in ${file}): ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }),
      );
      const all = { ...saved, ...Object.fromEntries(fetched) };
      const used = Object.fromEntries([...refs.keys()].sort().map((key) => [key, all[key]]));
      const json = `${JSON.stringify(used, null, 2)}\n`;
      if (!fs.existsSync(opts.snapshot) || fs.readFileSync(opts.snapshot, "utf8") !== json) {
        fs.writeFileSync(opts.snapshot, json);
      }
      return `export default new Map(Object.entries(${JSON.stringify(used)}));`;
    },
    handleHotUpdate({ file, server, modules }) {
      if (!file.endsWith(".md") || !opts.sourceDirs.some((dir) => file.startsWith(dir))) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (!mod) return;
      server.moduleGraph.invalidateModule(mod);
      return [...modules, mod];
    },
  };
}
