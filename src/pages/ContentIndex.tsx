import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import usePageTitle from "../hooks/usePageTitle";
import { stripFrontmatter, processMarkdown } from "../lib/content";

interface Props {
  section: "writing" | "lists";
  loadIndex: () => Promise<string>;
}

export default function ContentIndex({ section, loadIndex }: Props) {
  usePageTitle(section);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    loadIndex()
      .then((raw) => {
        setContent(processMarkdown(stripFrontmatter(raw), section));
      })
      .catch(() => {
        setContent("");
      });
  }, [loadIndex, section]);

  if (content === null) return <div>loading...</div>;

  return (
    <div>
      <h2>{section}</h2>
      <div className="prose prose-neutral max-w-none marker:text-[var(--color-fg-1)]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
