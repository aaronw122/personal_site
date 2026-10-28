import type { PluggableList } from "unified";

// Fenced code languages rendered as interactive simulations instead of code.
export const WAVE_LANGS = ["wave", "pulse", "slice"] as const;
export const SIM_LANGS: readonly string[] = [...WAVE_LANGS, "uwb-pulse"];

let math: PluggableList = [];
let highlight: PluggableList = [];

// KaTeX and highlight.js are most of the article renderer's weight, but few
// posts use math or highlighted code. Each is fetched only when the post's
// markdown (nutshell definitions included) needs it, so static imports would
// defeat the split.
export async function loadArticlePlugins(markdown: string): Promise<void> {
  const needsMath = markdown.includes("$");
  const needsHighlight = [...markdown.matchAll(/```([\w+-]+)/g)].some(
    ([, lang]) => !SIM_LANGS.includes(lang),
  );
  await Promise.all([
    needsMath && !math.length &&
      import("./katexPlugin").then((m) => {
        math = [m.default];
      }),
    needsHighlight && !highlight.length &&
      import("./highlightPlugin").then((m) => {
        highlight = [[m.default, { plainText: SIM_LANGS }]];
      }),
  ]);
}

// Rehype plugins for the loaded post, in the order they must run after rehype-raw.
export function articlePlugins(): PluggableList {
  return [...math, ...highlight];
}
