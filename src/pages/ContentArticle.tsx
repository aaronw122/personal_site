import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import usePageTitle from "../hooks/usePageTitle";
import {
  type ContentEntry,
  loadEntry,
  processMarkdown,
} from "../lib/content";
import ArticleMarkdown from "../components/ArticleMarkdown";

interface Props {
  section: "writing" | "lists";
  entries: ContentEntry[];
  // When set, serve this fixed slug instead of reading it from the URL param.
  // Used for standalone top-level routes (e.g. /haystack-errw-proof).
  fixedSlug?: string;
}

export default function ContentArticle({ section, entries, fixedSlug }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = fixedSlug ?? params.slug;
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
      <h1 className="article-title">{article.title}</h1>
      {article.date && (
        <p className="article-date">
          {new Date(article.date + "T00:00:00").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <div className="prose prose-content">
        <ArticleMarkdown
          markdown={processMarkdown(article.content, section)}
          section={section}
        />
      </div>
      <hr />
      <p>
        <Link to={`/${section}`} className="link-underline">
          &larr; back to {section}
        </Link>
      </p>
    </div>
  );
}
