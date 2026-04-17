import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeRaw from "rehype-raw";
import usePageTitle from "../hooks/usePageTitle";
import {
  type ContentEntry,
  loadEntry,
  processMarkdown,
} from "../lib/content";
import Lightbox from "../components/Lightbox";

function LightboxImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        {...props}
        className="cursor-pointer"
        tabIndex={0}
        role="button"
        aria-label="View full size image"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        src={props.src ?? ""}
        alt={props.alt}
      />
    </>
  );
}

interface Props {
  section: "writing" | "lists";
  entries: ContentEntry[];
}

export default function ContentArticle({ section, entries }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<{
    title: string;
    date: string | null;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(article?.title ?? section);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    loadEntry(entries, slug)
      .then((result) => {
        if (!cancelled) {
          setArticle(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArticle(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, entries]);

  if (loading) return <div>loading...</div>;
  if (!article) {
    return (
      <div>
        <h2>not found</h2>
        <p>
          <Link to={`/${section}`}>back to {section}</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>{article.title}</h2>
      {article.date && (
        <p className="text-sm opacity-50 -mt-2 mb-4">
          {new Date(article.date + "T00:00:00").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <div className="prose prose-neutral max-w-none marker:text-[var(--color-fg-1)]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          rehypePlugins={[rehypeRaw]}
          components={{ img: LightboxImage }}
        >
          {processMarkdown(article.content, section)}
        </ReactMarkdown>
      </div>
      <hr className="my-8" />
      <p>
        <Link to={`/${section}`} className="underline underline-offset-2">
          &larr; back to {section}
        </Link>
      </p>
    </div>
  );
}
