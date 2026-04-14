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

function slugFromPath(p: string): string {
  // Use the filename without extension as the slug — no encoding
  // React Router decodes URL params, so slugs must be unencoded to match
  return p.split("/").pop()!.replace(/\.md$/, "");
}

function extractFrontmatterTitle(raw: string): string | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const titleLine = match[1].split("\n").find((l) => l.startsWith("title:"));
  if (!titleLine) return null;
  return titleLine.replace("title:", "").trim().replace(/^["']|["']$/g, "");
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n*/, "");
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

function buildEntries(
  modules: Record<string, () => Promise<unknown>>,
): ContentEntry[] {
  return Object.entries(modules)
    .filter(([p]) => !p.endsWith("/index.md"))
    .map(([p, loader]) => ({
      slug: slugFromPath(p),
      title: slugFromPath(p),
      loader: loader as () => Promise<string>,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
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
): Promise<{ title: string; content: string } | null> {
  // React Router decodes URL params, so compare decoded slugs
  const decoded = decodeURIComponent(slug);
  const entry = entries.find((e) => e.slug === decoded);
  if (!entry) return null;
  const raw = await entry.loader();
  const fmTitle = extractFrontmatterTitle(raw);
  return {
    title: fmTitle || entry.title,
    content: stripFrontmatter(raw),
  };
}
