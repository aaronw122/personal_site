import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Experience from "./pages/Experience";
import ContentIndex from "./pages/ContentIndex";
import ContentArticle from "./pages/ContentArticle";
import Era from "./pages/Era";
import EraDevices from "./pages/EraDevices";
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
      {/* standalone immersive notebook — no site chrome */}
      <Route path="/era-notebook" element={<Era />} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
