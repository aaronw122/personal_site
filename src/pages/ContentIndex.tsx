import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import usePageTitle from "../hooks/usePageTitle";
import MarkdownLink from "../components/MarkdownLink";

interface Props {
  section: "writing" | "lists";
  load: () => Promise<string>;
}

export default function ContentIndex({ section, load }: Props) {
  usePageTitle(section);
  const content = use(load());

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
