import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import usePageTitle from "../hooks/usePageTitle";
import type { IndexSource } from "../lib/content";
import MarkdownLink from "../components/MarkdownLink";

interface Props {
  section: "writing" | "lists";
  index: IndexSource;
}

export default function ContentIndex({ section, index }: Props) {
  usePageTitle(section);
  const [content, setContent] = useState<string | null>(index.peek);

  useEffect(() => {
    const cached = index.peek();
    if (cached !== null) {
      setContent(cached);
      return;
    }
    let cancelled = false;
    setContent(null);
    index.load().then(
      (loaded) => !cancelled && setContent(loaded),
      () => !cancelled && setContent(""),
    );
    return () => {
      cancelled = true;
    };
  }, [index]);

  if (content === null) return <div>loading...</div>;

  return (
    <div>
      <h2>{section}</h2>
      <div className="prose prose-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          components={{ a: MarkdownLink }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {section === "writing" && (
        <p className="rss-link">
          <a href="/rss.xml">subscribe via rss</a>
        </p>
      )}
    </div>
  );
}
