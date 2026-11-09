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

const ContentIndex = lazy(() => import("./pages/ContentIndex"));
const ContentArticle = lazy(() => import("./pages/ContentArticle"));
const Era = lazy(() => import("./pages/Era"));
const EraDevices = lazy(() => import("./pages/EraDevices"));
const SpacingPanel = import.meta.env.DEV
  ? lazy(() => import("./components/SpacingPanel"))
  : null;

const writingEntries = getWritingEntries();
const listsEntries = getListsEntries();

const FIXED_ARTICLES = [
  { path: "/haystack-errw-proof", slug: "haystack-errw-proof" },
  { path: "/oboe", slug: "most inneficient way to find needle in a haystack" },
  { path: "/uwb-pt1", slug: "ultra-wideband pt. 1 - intuition" },
];

function preloadInitialArticle() {
  const path = window.location.pathname.replace(/\/$/, "");
  const fixed = FIXED_ARTICLES.find((a) => a.path === path);
  const match = path.match(/^\/(writing|lists)\/([^/]+)$/);
  const load = fixed
    ? loadEntry(writingEntries, fixed.slug)
    : match && loadEntry(match[1] === "writing" ? writingEntries : listsEntries, match[2]);
  load?.catch(() => {});
}
preloadInitialArticle();

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
        <Route
          path="/era-notebook"
          element={
            <Suspense fallback={<div>loading...</div>}>
              <Era />
            </Suspense>
          }
        />
        <Route path="/rick" element={<Rick />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
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
