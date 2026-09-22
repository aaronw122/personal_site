// Build-time (Node) helpers for reading Obsidian vault markdown. Shared by the
// vite plugins that emit static artifacts from the vault (OG prerender, RSS).
//
// src/lib/content.ts (browser bundle) has its own copies of extractFrontmatter,
// stripFrontmatter and processMarkdown; those three must stay in sync. They are
// not imported from here because tsconfig only covers src/.

// Escapes for XML/HTML text and double-quoted attributes. Also drops the C0
// control characters XML 1.0 forbids outright (everything below U+0020 except
// tab, LF, CR) — there is no escape that makes those legal.
export function htmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function extractFrontmatter(raw: string): Record<string, string> {
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

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
}

// Convert Obsidian syntax to standard markdown with ABSOLUTE urls, for
// consumers that render off-site (RSS readers). Twin of content.ts's
// processMarkdown, which emits site-relative paths for the SPA.
export function processMarkdown(
  raw: string,
  section: string,
  siteUrl: string,
): string {
  // ![[image.png]] / ![[image.png|300]] embeds → images (size hint dropped).
  let result = raw.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const file = inner.split("|")[0].trim();
    return `![${file}](${siteUrl}/writing-images/${encodeURIComponent(file)})`;
  });

  // [[target]] / [[target|alias]] wikilinks → links.
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_match, link: string) => {
    const [target, alias] = link.split("|");
    const display = alias?.trim() || target.trim();
    return `[${display}](${siteUrl}/${section}/${encodeURIComponent(target.trim())})`;
  });

  // images/foo.png references → synced writing-images.
  result = result.replace(
    /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
    (_match, alt: string, filename: string) =>
      `![${alt}](${siteUrl}/writing-images/${encodeURIComponent(filename)})`,
  );

  return result;
}

// Pull a plain-text summary from the first real paragraph of the body.
export function deriveDescription(body: string, fallback: string): string {
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
