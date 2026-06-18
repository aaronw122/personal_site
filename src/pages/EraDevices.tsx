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
// device sketches (bundled + content-hashed)
import quillDevice from "../era-art/quill-device.png";
import tigerDevice from "../era-art/tiger-device.png";

// map the Obsidian image embeds in the .md to the bundled device sketches
const IMAGES: Record<string, string> = {
  "ChatGPT Image Jun 17 2026 (1).png": quillDevice,
  "ChatGPT Image Jun 17 2026 (2).png": tigerDevice,
};

function prepare(md: string): string {
  return (
    md
      // drop private author notes (e.g. "**aaron note:** ...")
      .replace(/^\s*\*\*aaron note:\*\*.*$/gim, "")
      // Obsidian ![[embed]] -> standard markdown image pointing at the bundled asset
      .replace(/!\[\[([^\]]+)\]\]/g, (_m, name: string) => {
        const url = IMAGES[name.trim()];
        return url ? `![${name.trim()}](${url})` : "";
      })
      .trim()
  );
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
