import { useRef } from "react";
import "./wave.css";
import useLazyMount from "../../hooks/useLazyMount";

// Reserve the canvas space before the expensive expression compilation and drawing run.
function estimatedHeight(lang: "wave" | "pulse" | "slice", source: string): number {
  if (lang === "pulse") return 450;
  if (lang === "slice") return 710;

  let globalHeight: number | undefined;
  const panels: Array<{ height?: number; legends: number; formulas: number }> = [];
  let explicitPanel = false;
  let sliders = 0;
  let readouts = 0;
  let plays = 0;
  let title = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().split(/\s+/)[0];
    if (key === "panel") {
      panels.push({ legends: 0, formulas: 0 });
      explicitPanel = true;
    } else if (key === "height") {
      const height = Number(line.slice(colon + 1).trim());
      if (Number.isFinite(height) && height >= 60) {
        if (explicitPanel) panels[panels.length - 1].height = height;
        else globalHeight = height;
      }
    } else if (key === "slider") sliders++;
    else if (key === "readout") readouts++;
    else if (key === "play") plays++;
    else if (key === "title") title = true;
    else if (key === "plot" || key === "family" || key === "stems" || key === "arrow" || key === "formula") {
      if (!panels.length) panels.push({ legends: 0, formulas: 0 });
      if (key === "formula") panels[panels.length - 1].formulas++;
      else if (!line.slice(0, colon).includes("nolegend")) panels[panels.length - 1].legends++;
    }
  }
  const count = Math.max(1, panels.length);
  const base = globalHeight ?? (count > 1 ? 200 : 280);
  return Math.ceil(20 + (title ? 28 : 0) + (sliders + plays) * 32 + readouts * 24 +
    panels.reduce((sum, panel) => sum + (panel.height ?? base) + (explicitPanel ? 24 : 0) +
      (panel.legends ? Math.ceil(panel.legends / 3) * 25 : 0) + panel.formulas * 25 + 14, 0));
}

export default function WaveBlock({ lang, source }: { lang: "wave" | "pulse" | "slice"; source: string }) {
  const container = useRef<HTMLDivElement>(null);

  useLazyMount(
    container,
    // The simulator is fetched only when a block nears the viewport, so its code
    // stays out of the chunk the article text waits on.
    async (element) => {
      const { mountWaveBlock } = await import("./wavePlot.js");
      const cleanup = mountWaveBlock(lang, source, element);
      element.style.minHeight = "";
      return cleanup;
    },
    [lang, source],
  );

  return <div ref={container} className="wave-block" style={{ minHeight: estimatedHeight(lang, source) }} />;
}
