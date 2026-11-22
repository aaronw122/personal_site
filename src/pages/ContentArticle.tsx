import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import usePageTitle from "../hooks/usePageTitle";
import {
  type ContentEntry,
  type LoadedEntry,
  loadEntry,
  peekEntry,
  processMarkdown,
} from "../lib/content";
import { urlSlug } from "../lib/slug";
import { articlePluginsReady, loadArticlePlugins } from "../lib/articlePlugins";
import ArticleMarkdown from "../components/ArticleMarkdown";

interface Props {
  section: "writing" | "lists";
  entries: ContentEntry[];
  fixedSlug?: string;
}

type ArticleState = { slug: string; article: LoadedEntry | null; loading: boolean };

export default function ContentArticle({ section, entries, fixedSlug }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = fixedSlug ?? params.slug ?? "";
  const [state, setState] = useState<ArticleState>(() => {
    const article = peekEntry(entries, slug);
    return { slug, article, loading: !article };
  });
  const [, setPluginsLoaded] = useState(0);

  const stale = state.slug !== slug;
  const cached = stale ? peekEntry(entries, slug) : null;
  const { article, loading } = stale ? { article: cached, loading: !cached } : state;

  usePageTitle(article?.title ?? section);

  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const canonical = fixedSlug ? null : urlSlug(slug);
  useEffect(() => {
    if (canonical && canonical !== slug && article) {
      navigate(`/${section}/${canonical}${search}${hash}`, { replace: true });
    }
  }, [canonical, slug, article, section, search, hash, navigate]);

  useEffect(() => {
    let cancelled = false;
    const cached = peekEntry(entries, slug);
    if (cached) {
      setState({ slug, article: cached, loading: false });
      return;
    }
    setState({ slug, article: null, loading: true });
    loadEntry(entries, slug)
      .then((result) => {
        if (!cancelled) setState({ slug, article: result, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ slug, article: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, entries]);

  const content = article?.content;
  useEffect(() => {
    if (content === undefined || articlePluginsReady(content)) return;
    let cancelled = false;
    loadArticlePlugins(content)
      .then(() => {
        if (!cancelled) setPluginsLoaded((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [content]);

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
    </div>
  );
}
