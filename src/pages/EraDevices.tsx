import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import rehypeRaw from "rehype-raw";
import usePageTitle from "../hooks/usePageTitle";
import MarkdownLink from "../components/MarkdownLink";
import "./EraDevices.css";

// live content — editing this .md and redeploying updates the page
import raw from "@era-content/era devices.md?raw";

// resolve Obsidian image embeds against the vault's attachment folder by
// basename, so swapping/renaming images never needs a code change
const imageModules = import.meta.glob("@era-images/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const IMAGES: Record<string, string> = {};
for (const [path, url] of Object.entries(imageModules)) {
  const base = path.split("/").pop();
  if (base) IMAGES[base] = url;
}

function prepare(md: string): string {
  // verbatim content — only resolve ![[embeds]] to real image URLs
  return md
    .replace(/!\[\[([^\]]+)\]\]/g, (_m, name: string) => {
      const url = IMAGES[name.trim()];
      return url ? `![${name.trim()}](${url})` : "";
    })
    .trim();
}

export default function EraDevices() {
  usePageTitle("era");
  return (
    <div className="era-md">
      <h1 className="article-title">era</h1>
      <div className="prose prose-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkFrontmatter]}
          rehypePlugins={[rehypeRaw]}
          components={{ a: MarkdownLink }}
        >
          {prepare(raw)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
