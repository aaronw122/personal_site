import { useLayoutEffect, type RefObject } from "react";

// Below this, a formula is too small to read; it scrolls sideways instead.
const MIN_SCALE = 0.5;

function fit(display: HTMLElement) {
  const math = display.querySelector<HTMLElement>(".katex");
  if (!math) return;
  math.style.fontSize = "";
  const scale = display.clientWidth / display.scrollWidth;
  if (scale >= 1) return;
  const size = parseFloat(getComputedStyle(math).fontSize);
  // Slightly under the exact ratio so subpixel rounding can't leave a scrollbar.
  math.style.fontSize = `${size * Math.max(scale * 0.98, MIN_SCALE)}px`;
}

// Shrinks display equations that are wider than their column, so a long
// formula fits a phone screen instead of widening (and zooming out) the page.
export default function useFitDisplayMath(root: RefObject<HTMLElement | null>, markdown: string) {
  useLayoutEffect(() => {
    const displays = [...(root.current?.querySelectorAll<HTMLElement>(".katex-display") ?? [])];
    if (!displays.length) return;
    const fitAll = () => displays.forEach(fit);
    fitAll();
    // KaTeX's fonts change glyph widths once loaded; column width changes on rotation.
    let cancelled = false;
    document.fonts.ready.then(() => !cancelled && fitAll());
    const observer = new ResizeObserver(fitAll);
    displays.forEach((display) => observer.observe(display));
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [root, markdown]);
}
