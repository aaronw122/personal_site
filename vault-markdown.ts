export function htmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Frontmatter {
  title?: string;
  creation_date?: string;
}

export function extractFrontmatter(raw: string): Frontmatter {
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

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
}

export function processMarkdown(
  raw: string,
  section: string,
  siteUrl: string,
): string {
  let result = raw.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const file = inner.split("|")[0].trim();
    return `![${file}](${siteUrl}/writing-images/${encodeURIComponent(file)})`;
  });

  result = result.replace(/\[\[([^\]]+)\]\]/g, (_match, link: string) => {
    const [target, alias] = link.split("|");
    const display = alias?.trim() || target.trim();
    const slug = target.trim().split("/").pop()!.trim();
    return `[${display}](${siteUrl}/${section}/${encodeURIComponent(slug)})`;
  });

  result = result.replace(
    /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
    (_match, alt: string, filename: string) =>
      `![${alt}](${siteUrl}/writing-images/${encodeURIComponent(filename)})`,
  );

  return result;
}

export function deriveDescription(body: string, fallback: string): string {
  const lines = stripFrontmatter(body).split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (/^!?\[\[.*\]\]$/.test(line)) continue;
    if (/^!\[.*\]\(.*\)$/.test(line)) continue;
    if (/^(---|\*\*\*|___)$/.test(line)) continue;
    let text = line
      .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, a) => a || t)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>#]/g, "")
      .trim();
    if (!text) continue;
    if (text.length > 200) text = text.slice(0, 197).trimEnd() + "…";
    return text;
  }
  return fallback;
}
