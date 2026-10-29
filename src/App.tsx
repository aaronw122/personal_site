import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Experience from "./pages/Experience";
import NotFound from "./pages/NotFound";
import Rick from "./pages/Rick";
import { getWritingEntries, getListsEntries, loadEntry } from "./lib/content";
import useNavHaptics from "./hooks/useNavHaptics";

// Split off the routes that drag in heavy deps (react-markdown + remark/rehype,
// KaTeX, highlight.js, the Era notebook) so the home page's initial bundle
// doesn't pay for them.
const ContentIndex = lazy(() => import("./pages/ContentIndex"));
const ContentArticle = lazy(() => import("./pages/ContentArticle"));
const Era = lazy(() => import("./pages/Era"));
const EraDevices = lazy(() => import("./pages/EraDevices"));
// TEMPORARY: dev-only line-spacing tuner. `import.meta.env.DEV` is statically
// false in production builds, so the chunk is never emitted. Remove together
// with components/SpacingPanel.tsx.
const SpacingPanel = import.meta.env.DEV
  ? lazy(() => import("./components/SpacingPanel"))
  : null;

const writingEntries = getWritingEntries();
const listsEntries = getListsEntries();

// Standalone top-level routes that render a specific writing post.
const FIXED_ARTICLES = [
  { path: "/haystack-errw-proof", slug: "haystack-errw-proof" },
  { path: "/oboe", slug: "most inneficient way to find needle in a haystack" },
  { path: "/uwb-pt1", slug: "ultrawide band pt. 1 - intuition" },
];

// Start fetching the post this page opened on (its markdown plus any math or
// highlighting it needs) alongside the article chunk, instead of after it.
function preloadInitialArticle() {
  const path = window.location.pathname.replace(/\/$/, "");
  const fixed = FIXED_ARTICLES.find((a) => a.path === path);
  const match = path.match(/^\/(writing|lists)\/([^/]+)$/);
  const load = fixed
    ? loadEntry(writingEntries, fixed.slug)
    : match && loadEntry(match[1] === "writing" ? writingEntries : listsEntries, match[2]);
  // The article page reports failures when it awaits the same load.
  load?.catch(() => {});
}
preloadInitialArticle();

// Index file loaders — these point to the curated index.md in each Obsidian folder
const loadWritingIndex = () =>
  import("@writing/index.md?raw").then((m) => m.default);
const loadListsIndex = () =>
  import("@lists/index.md?raw").then((m) => m.default);

export default function App() {
  useNavHaptics();
  return (
    <>
      {SpacingPanel && (
        <Suspense fallback={null}>
          <SpacingPanel />
        </Suspense>
      )}
      <Routes>
        {/* standalone immersive notebook — no site chrome, so its own Suspense */}
        <Route
          path="/era-notebook"
          element={
            <Suspense fallback={<div>loading...</div>}>
              <Era />
            </Suspense>
          }
        />
        {/* standalone full-screen rickroll — no site chrome */}
        <Route path="/rick" element={<Rick />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          {/* simple md-driven page */}
          <Route path="/era" element={<EraDevices />} />
          <Route path="/about" element={<About />} />
          <Route path="/experience" element={<Experience />} />
          <Route
            path="/writing"
            element={
              <ContentIndex section="writing" loadIndex={loadWritingIndex} />
            }
          />
          <Route
            path="/writing/:slug"
            element={
              <ContentArticle section="writing" entries={writingEntries} />
            }
          />
          <Route
            path="/lists"
            element={
              <ContentIndex section="lists" loadIndex={loadListsIndex} />
            }
          />
          <Route
            path="/lists/:slug"
            element={
              <ContentArticle section="lists" entries={listsEntries} />
            }
          />
          {FIXED_ARTICLES.map(({ path, slug }) => (
            <Route
              key={path}
              path={path}
              element={
                <ContentArticle
                  section="writing"
                  entries={writingEntries}
                  fixedSlug={slug}
                />
              }
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
