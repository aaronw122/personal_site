import type { PluggableList } from "unified";

export const WAVE_LANGS = ["wave", "pulse", "slice"] as const;
export const SIM_LANGS: readonly string[] = [...WAVE_LANGS, "uwb-pulse", "ar-pose", "mermaid", "tweet"];

let math: PluggableList = [];
let highlight: PluggableList = [];
let mathLoad: Promise<void> | null = null;
let highlightLoad: Promise<void> | null = null;

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

function clientOnlyFallback(error: Error): void {
  if (import.meta.env.SSR) throw error;
}

export function articlePluginLoads(markdown: string): Promise<void>[] {
  const loads: Promise<void>[] = [];
  if (needsMath(markdown)) {
    mathLoad ??= import("./katexPlugin").then((m) => {
      math = [m.default];
    }, clientOnlyFallback);
    loads.push(mathLoad);
  }
  if (needsHighlight(markdown)) {
    highlightLoad ??= import("./highlightPlugin").then((m) => {
      highlight = [[m.default, { plainText: SIM_LANGS }]];
    }, clientOnlyFallback);
    loads.push(highlightLoad);
  }
  return loads;
}

export function articlePlugins(markdown: string): PluggableList {
  return [...(needsMath(markdown) ? math : []), ...(needsHighlight(markdown) ? highlight : [])];
}
