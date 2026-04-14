import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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

function LightboxImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) overlayRef.current?.focus();
  }, [open]);

  return (
    <>
      <img {...props} className="cursor-pointer" onClick={() => setOpen(true)} />
      {open && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={props.alt || "Enlarged image"}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 outline-none"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none cursor-pointer"
            aria-label="Close lightbox"
            onClick={() => setOpen(false)}
          >
            &times;
          </button>
          <img
            src={props.src}
            alt={props.alt}
            className="max-w-[90vw] max-h-[85vh] rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(article?.title ?? section);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    loadEntry(entries, slug)
      .then((result) => {
        setArticle(result);
        setLoading(false);
      })
      .catch(() => {
        setArticle(null);
        setLoading(false);
      });
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
