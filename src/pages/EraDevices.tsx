import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import rehypeRaw from "rehype-raw";
import usePageTitle from "../hooks/usePageTitle";
import MarkdownLink from "../components/MarkdownLink";
import "./EraDevices.css";

import raw from "@era-content/era/era devices 2.md?raw";

function prepare(md: string): string {
  return md
    .replace(/!\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
      const file = inner.split("|")[0].trim();
      return `![${file}](/writing-images/${encodeURIComponent(file)})`;
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
