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

// Convert [[wikilinks]] to standard markdown links and fix image paths
export function processMarkdown(
  raw: string,
  section: "writing" | "lists",
): string {
  // Convert ![[image.png]] embeds to standard markdown images
  let result = raw.replace(/!\[\[([^\]]+)\]\]/g, (_match, filename: string) => {
    return `![${filename}](/writing-images/${encodeURIComponent(filename)})`;
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

export async function loadEntry(
  entries: ContentEntry[],
  slug: string,
): Promise<{ title: string; date: string | null; content: string } | null> {
  // React Router decodes URL params, so compare decoded slugs
  const decoded = decodeURIComponent(slug);
  const entry = entries.find((e) => e.slug === decoded);
  if (!entry) return null;
  const raw = await entry.loader();
  const fm = extractFrontmatter(raw);
  return {
    title: fm.title || entry.title,
    date: fm.creation_date || null,
    content: stripFrontmatter(raw),
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
