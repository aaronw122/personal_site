import { useLayoutEffect, type RefObject } from "react";

const MIN_SCALE = 0.5;

function fit(display: HTMLElement) {
  const math = display.querySelector<HTMLElement>(".katex");
  if (!math) return;
  math.style.fontSize = "";
  const scale = display.clientWidth / display.scrollWidth;
  if (scale >= 1) return;
  const size = parseFloat(getComputedStyle(math).fontSize);
  math.style.fontSize = `${size * Math.max(scale * 0.98, MIN_SCALE)}px`;
}

export default function useFitDisplayMath(root: RefObject<HTMLElement | null>, markdown: string) {
  useLayoutEffect(() => {
    const displays = [...(root.current?.querySelectorAll<HTMLElement>(".katex-display") ?? [])];
    if (!displays.length) return;
    const fitAll = () => displays.forEach(fit);
    fitAll();
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
