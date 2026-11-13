import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import AvatarStage from "./components/AvatarStage";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { getWritingEntries, getListsEntries, loadEntry } from "./lib/content";
import useNavHaptics from "./hooks/useNavHaptics";

const ContentIndex = lazy(() => import("./pages/ContentIndex"));
const ContentArticle = lazy(() => import("./pages/ContentArticle"));
const Era = lazy(() => import("./pages/Era"));
const EraDevices = lazy(() => import("./pages/EraDevices"));
const About = lazy(() => import("./pages/About"));
const Experience = lazy(() => import("./pages/Experience"));
const Podcast = lazy(() => import("./pages/Podcast"));
const Rick = lazy(() => import("./pages/Rick"));
const SpacingPanel = import.meta.env.DEV
  ? lazy(() => import("./components/SpacingPanel"))
  : null;
const StageDemo = import.meta.env.DEV ? lazy(() => import("./pages/StageDemo")) : null;
const PeekSpriteRender = import.meta.env.DEV ? lazy(() => import("./pages/PeekSpriteRender")) : null;

const writingEntries = getWritingEntries();
const listsEntries = getListsEntries();

const FIXED_ARTICLES = [
  { path: "/haystack-errw-proof", slug: "haystack-errw-proof" },
  { path: "/oboe", slug: "most inneficient way to find needle in a haystack" },
  { path: "/uwb-pt1", slug: "ultra-wideband pt. 1 - intuition" },
];

export function preloadInitialArticle() {
  const path = window.location.pathname.replace(/\/$/, "");
  const fixed = FIXED_ARTICLES.find((a) => a.path === path);
  const match = path.match(/^\/(writing|lists)\/([^/]+)$/);
  const load = fixed
    ? loadEntry(writingEntries, fixed.slug)
    : match && loadEntry(match[1] === "writing" ? writingEntries : listsEntries, match[2]);
  load?.catch(() => {});
}

const loadWritingIndex = () =>
  import("@writing/index.md?raw").then((m) => m.default);
const loadListsIndex = () =>
  import("@lists/index.md?raw").then((m) => m.default);

export default function App() {
  useNavHaptics();
  const { pathname } = useLocation();
  const demo = import.meta.env.DEV && pathname === "/stage";
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
        <Route
          path="/rick"
          element={
            <Suspense fallback={null}>
              <Rick />
            </Suspense>
          }
        />
        {PeekSpriteRender && <Route path="/peek-sprite-render" element={<PeekSpriteRender />} />}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/era" element={<EraDevices />} />
          <Route path="/about" element={<About />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="/podcast" element={<Podcast />} />
          {StageDemo && <Route path="/stage" element={<StageDemo />} />}
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
      <AvatarStage demo={demo} />
    </>
  );
}
