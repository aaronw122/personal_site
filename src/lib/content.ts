import { headingSlug, nutshellsToHtml } from "./nutshell";
import { loadArticlePlugins } from "./articlePlugins";

// Discover and load markdown content from Obsidian vault via Vite aliases

const writingModules = import.meta.glob("@writing/**/*.md", {
  query: "?raw",
  import: "default",
});

const listsModules = import.meta.glob("@lists/**/*.md", {
  query: "?raw",
  import: "default",
});

export interface ContentEntry {
  slug: string;
  title: string;
  loader: () => Promise<string>;
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
}

// Convert Obsidian syntax (nutshell terms, toggle callouts, [[wikilinks]],
// embeds) to markdown/HTML the article renderer understands
export function processMarkdown(
  raw: string,
  section: "writing" | "lists",
): string {
  // Nutshell definition terms become popover spans. Runs first: stored
  // definitions can hold [[links]] and embeds that are converted when the
  // definition itself is rendered.
  let result = nutshellsToHtml(raw);

  // `> [!toggle]- summary` callouts (toggle-block plugin) become <details>.
  // The first line is the summary; the remaining quoted lines are the body.
  result = result.replace(
    /^> \[!toggle\][-+]? ?(.*)\n((?:>.*(?:\n|$))*)/gm,
    (_match, summary: string, body: string) => {
      const inner = body.replace(/^> ?/gm, "").trim();
      return `<details class="toggle-block"><summary>${summary.trim()}</summary>\n\n${inner}\n\n</details>\n`;
    },
  );

  // Obsidian renders a line that is only `$$...$$` as display math; remark-math
  // treats it as inline math (and merges adjacent lines into one paragraph).
  // Expand such lines into fenced `$$` blocks, leaving code fences untouched.
  let inFence = false;
  result = result
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const math = inFence ? null : line.match(/^\s*\$\$(.+)\$\$\s*$/);
      return math ? `\n$$\n${math[1].trim()}\n$$\n` : line;
    })
    .join("\n");

  // Convert ![[image.png]] embeds to standard markdown images. Obsidian allows a
  // trailing size hint (![[image.png|300]]); split it off so only the real
  // filename is encoded into the URL (encoding the whole string yields %7C 404s).
  result = result.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const file = inner.split("|")[0].trim();
    return `![${file}](/writing-images/${encodeURIComponent(file)})`;
  });

  // [[#heading|alias]] links point at a heading on the same page
  result = result.replace(/\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => {
    return `[${(alias ?? target).trim()}](#${headingSlug(target)})`;
  });

  // Convert [[wikilinks]] to standard markdown links
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_match, link: string) => {
    const [target, alias] = link.split("|");
    const display = alias?.trim() || target.trim();
    return `[${display}](/${section}/${encodeURIComponent(target.trim())})`;
  });

  // Fix standard markdown image references to images/ subfolder
  result = result.replace(
    /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
    (_match, alt: string, filename: string) => {
      return `![${alt}](/writing-images/${encodeURIComponent(filename)})`;
    },
  );

  return result;
}

export function getWritingEntries(): ContentEntry[] {
  return buildEntries(writingModules);
}

export function getListsEntries(): ContentEntry[] {
  return buildEntries(listsModules);
}

type LoadedEntry = { title: string; date: string | null; content: string };

// One load per post, shared by the startup preload and the article page.
const entryLoads = new Map<string, Promise<LoadedEntry | null>>();

export function loadEntry(
  entries: ContentEntry[],
  slug: string,
): Promise<LoadedEntry | null> {
  // React Router decodes URL params, so compare decoded slugs
  const decoded = decodeURIComponent(slug);
  const entry = entries.find((e) => e.slug === decoded);
  if (!entry) return Promise.resolve(null);
  let load = entryLoads.get(entry.slug);
  if (!load) {
    load = fetchEntry(entry);
    entryLoads.set(entry.slug, load);
    // Let a failed load (e.g. a dropped connection) be retried on the next visit.
    load.catch(() => entryLoads.delete(entry.slug));
  }
  return load;
}

async function fetchEntry(entry: ContentEntry): Promise<LoadedEntry> {
  const raw = await entry.loader();
  const fm = extractFrontmatter(raw);
  const content = stripFrontmatter(raw);
  await loadArticlePlugins(content);
  return {
    title: fm.title || entry.title,
    date: fm.creation_date || null,
    content,
  };
}

// — Private helpers —

function slugFromPath(p: string): string {
  // Use the filename without extension as the slug — no encoding
  // React Router decodes URL params, so slugs must be unencoded to match
  return p.split("/").pop()!.replace(/\.md$/, "");
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

function buildEntries(
  markdownModules: Record<string, () => Promise<unknown>>,
): ContentEntry[] {
  return Object.entries(markdownModules)
    .filter(([p]) => !p.endsWith("/index.md"))
    .map(([p, loader]) => ({
      slug: slugFromPath(p),
      title: slugFromPath(p),
      loader: loader as () => Promise<string>,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
