import type { PluggableList } from "unified";

export const WAVE_LANGS = ["wave", "pulse", "slice"] as const;
export const SIM_LANGS: readonly string[] = [...WAVE_LANGS, "uwb-pulse"];

let math: PluggableList = [];
let highlight: PluggableList = [];

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

export function articlePlugins(): PluggableList {
  return [...math, ...highlight];
}
