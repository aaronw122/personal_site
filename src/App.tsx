import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Experience from "./pages/Experience";
import NotFound from "./pages/NotFound";
import { getWritingEntries, getListsEntries } from "./lib/content";
import useNavHaptics from "./hooks/useNavHaptics";

// Split off the routes that drag in heavy deps (react-markdown + remark/rehype,
// KaTeX, highlight.js, the Era notebook) so the home page's initial bundle
// doesn't pay for them.
const ContentIndex = lazy(() => import("./pages/ContentIndex"));
const ContentArticle = lazy(() => import("./pages/ContentArticle"));
const Era = lazy(() => import("./pages/Era"));
const EraDevices = lazy(() => import("./pages/EraDevices"));

const writingEntries = getWritingEntries();
const listsEntries = getListsEntries();

// Index file loaders — these point to the curated index.md in each Obsidian folder
const loadWritingIndex = () =>
  import("@writing/index.md?raw").then((m) => m.default);
const loadListsIndex = () =>
  import("@lists/index.md?raw").then((m) => m.default);

export default function App() {
  useNavHaptics();
  return (
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
        <Route
          path="/haystack-errw-proof"
          element={
            <ContentArticle
              section="writing"
              entries={writingEntries}
              fixedSlug="haystack-errw-proof"
            />
          }
        />
        <Route
          path="/oboe"
          element={
            <ContentArticle
              section="writing"
              entries={writingEntries}
              fixedSlug="most inneficient way to find needle in a haystack"
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
