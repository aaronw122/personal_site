import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { Suspense, use, useEffect } from "react";
import usePageTitle from "../hooks/usePageTitle";
import { type ContentEntry, loadEntry, processMarkdown } from "../lib/content";
import { urlSlug } from "../lib/slug";
import { articlePluginLoads } from "../lib/articlePlugins";
import ArticleMarkdown from "../components/ArticleMarkdown";

interface Props {
  section: "writing" | "lists";
  entries: ContentEntry[];
  fixedSlug?: string;
}

interface BodyProps {
  markdown: string;
  section: Props["section"];
  pluginLoads: Promise<void>[];
}

function StyledBody({ markdown, section, pluginLoads }: BodyProps) {
  for (const load of pluginLoads) use(load);
  return <ArticleMarkdown markdown={markdown} section={section} />;
}

export default function ContentArticle({ section, entries, fixedSlug }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = fixedSlug ?? params.slug ?? "";
  const article = use(loadEntry(entries, slug));

  usePageTitle(article?.title ?? section);

  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const canonical = fixedSlug ? null : urlSlug(slug);
  useEffect(() => {
    if (canonical && canonical !== slug && article) {
      navigate(`/${section}/${canonical}${search}${hash}`, { replace: true });
    }
  }, [canonical, slug, article, section, search, hash, navigate]);

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

  const markdown = processMarkdown(article.content, section);
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
        <Suspense fallback={<ArticleMarkdown markdown={markdown} section={section} />}>
          <StyledBody
            markdown={markdown}
            section={section}
            pluginLoads={articlePluginLoads(article.content)}
          />
        </Suspense>
      </div>
    </div>
  );
}
