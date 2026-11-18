import type { PluggableList } from "unified";

export const WAVE_LANGS = ["wave", "pulse", "slice"] as const;
export const SIM_LANGS: readonly string[] = [...WAVE_LANGS, "uwb-pulse", "ar-pose", "mermaid"];

let math: PluggableList = [];
let highlight: PluggableList = [];

function needsMath(markdown: string): boolean {
  const prose = markdown
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, "")
    .replace(/`[^`\n]*`/g, "");
  return /\$\$[\s\S]+?\$\$|\$[^\s$][^$\n]*?[^\s$\\]\$|\$[^\s$]\$/.test(prose);
}

function needsHighlight(markdown: string): boolean {
  return [...markdown.matchAll(/```([\w+-]+)/g)].some(
    ([, lang]) => !SIM_LANGS.includes(lang),
  );
}

export function articlePluginsReady(markdown: string): boolean {
  return (!needsMath(markdown) || math.length > 0) &&
    (!needsHighlight(markdown) || highlight.length > 0);
}

export async function loadArticlePlugins(markdown: string): Promise<void> {
  await Promise.all([
    needsMath(markdown) && !math.length &&
      import("./katexPlugin").then((m) => {
        math = [m.default];
      }),
    needsHighlight(markdown) && !highlight.length &&
      import("./highlightPlugin").then((m) => {
        highlight = [[m.default, { plainText: SIM_LANGS }]];
      }),
  ]);
}

export function articlePlugins(markdown: string): PluggableList {
  return [...(needsMath(markdown) ? math : []), ...(needsHighlight(markdown) ? highlight : [])];
}
