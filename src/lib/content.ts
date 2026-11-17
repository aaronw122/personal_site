import { headingSlug, nutshellsToHtml } from "./nutshell";

const writingModules = import.meta.glob<string>("@writing/**/*.md", {
  query: "?raw",
  import: "default",
});

const listsModules = import.meta.glob<string>("@lists/**/*.md", {
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

export function processMarkdown(
  raw: string,
  section: "writing" | "lists",
): string {
  let result = nutshellsToHtml(raw);

  result = result.replace(
    /^> \[!toggle\][-+]? ?(.*)\n((?:>.*(?:\n|$))*)/gm,
    (_match, summary: string, body: string) => {
      const inner = body.replace(/^> ?/gm, "").trim();
      return `<details class="toggle-block"><summary>${summary.trim()}</summary>\n\n${inner}\n\n</details>\n`;
    },
  );

  let inFence = false;
  result = result
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const math = inFence ? null : line.match(/^\s*\$\$(.+)\$\$\s*$/);
      return math ? `\n$$\n${math[1].trim()}\n$$\n` : line;
    })
    .join("\n");

  result = result.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const file = inner.split("|")[0].trim();
    return `![${file}](/writing-images/${encodeURIComponent(file)})`;
  });

  result = result.replace(/\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => {
    return `[${(alias ?? target).trim()}](#${headingSlug(target)})`;
  });

  result = result.replace(/\[\[([^\]]+)\]\]/g, (_match, link: string) => {
    const [target, alias] = link.split("|");
    const display = alias?.trim() || target.trim();
    const slug = target.trim().split("/").pop()!.trim();
    return `[${display}](/${section}/${encodeURIComponent(slug)})`;
  });

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

export type LoadedEntry = { title: string; date: string | null; content: string };

const entryLoads = new Map<ContentEntry, Promise<LoadedEntry>>();
const loadedEntries = new Map<ContentEntry, LoadedEntry>();

function findEntry(entries: ContentEntry[], slug: string): ContentEntry | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return undefined;
  }
  return entries.find((e) => e.slug === decoded);
}

export function peekEntry(entries: ContentEntry[], slug: string): LoadedEntry | null {
  const entry = findEntry(entries, slug);
  return (entry && loadedEntries.get(entry)) ?? null;
}

export function loadEntry(
  entries: ContentEntry[],
  slug: string,
): Promise<LoadedEntry | null> {
  const entry = findEntry(entries, slug);
  if (!entry) return Promise.resolve(null);
  let load = entryLoads.get(entry);
  if (!load) {
    load = fetchEntry(entry);
    entryLoads.set(entry, load);
    load.then(
      (loaded) => loadedEntries.set(entry, loaded),
      () => entryLoads.delete(entry),
    );
  }
  return load;
}

async function fetchEntry(entry: ContentEntry): Promise<LoadedEntry> {
  const raw = await entry.loader();
  const fm = extractFrontmatter(raw);
  return {
    title: fm.title || entry.title,
    date: fm.creation_date || null,
    content: stripFrontmatter(raw),
  };
}

export interface IndexSource {
  load: () => Promise<string>;
  peek: () => string | null;
}

export function createIndexSource(
  section: "writing" | "lists",
  loader: () => Promise<string>,
): IndexSource {
  let load: Promise<string> | null = null;
  let value: string | null = null;
  return {
    load: () => {
      load ??= loader().then(
        (raw) => (value = processMarkdown(stripFrontmatter(raw), section)),
        (error: Error) => {
          load = null;
          throw error;
        },
      );
      return load;
    },
    peek: () => value,
  };
}

function slugFromPath(p: string): string {
  return p.split("/").pop()!.replace(/\.md$/, "");
}

interface Frontmatter {
  title?: string;
  creation_date?: string;
}

function extractFrontmatter(raw: string): Frontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const values = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val) values.set(key, val);
  }
  return { title: values.get("title"), creation_date: values.get("creation_date") };
}

function buildEntries(
  markdownModules: Record<string, () => Promise<string>>,
): ContentEntry[] {
  return Object.entries(markdownModules)
    .filter(([p]) => !p.endsWith("/index.md"))
    .map(([p, loader]) => ({
      slug: slugFromPath(p),
      title: slugFromPath(p),
      loader,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
