import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Experience from "./pages/Experience";
import ContentIndex from "./pages/ContentIndex";
const ContentArticle = React.lazy(() => import("./pages/ContentArticle"));
import NotFound from "./pages/NotFound";
import { getWritingEntries, getListsEntries } from "./lib/content";

const writingEntries = getWritingEntries();
const listsEntries = getListsEntries();

// Index file loaders — these point to the curated index.md in each Obsidian folder
const loadWritingIndex = () =>
  import("@writing/index.md?raw").then((m) => m.default);
const loadListsIndex = () =>
  import("@lists/index.md?raw").then((m) => m.default);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
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
            <Suspense fallback={null}>
              <ContentArticle section="writing" entries={writingEntries} />
            </Suspense>
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
            <Suspense fallback={null}>
              <ContentArticle section="lists" entries={listsEntries} />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
