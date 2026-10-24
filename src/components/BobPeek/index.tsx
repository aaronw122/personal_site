import { useEffect, useRef, useState } from "react";
import type { PeekScene } from "./bobPeekScene";
import StrumPlayer from "./StrumPlayer";

type Props = { hands?: "scan" | "cartoon"; headTurn?: "auto" | "left" | "centre" | "right" };
const desktopQuery = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export default function BobPeek({ hands = "cartoon", headTurn = "auto" }: Props) {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && matchMedia(desktopQuery).matches);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const options = useRef({ headTurn, reduced, hover });
  options.current = { headTurn, reduced, hover };

  useEffect(() => {
    const desktopMedia = matchMedia(desktopQuery);
    const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
    const updateDesktop = () => setDesktop(desktopMedia.matches);
    const updateMotion = () => setReduced(motionMedia.matches);
    desktopMedia.addEventListener("change", updateDesktop);
    motionMedia.addEventListener("change", updateMotion);
    return () => {
      desktopMedia.removeEventListener("change", updateDesktop);
      motionMedia.removeEventListener("change", updateMotion);
    };
  }, []);

  useEffect(() => {
    if (!desktop || expanded || !host.current) return;
    const container = host.current;
    let dead = false;
    let scene: PeekScene | undefined;
    let frame = 0;
    let idle = 0;
    let timeout = 0;
    let visible = true;
    let previous = 0;
    const resize = () => scene?.resize(container.clientWidth, container.clientHeight);
    const loop = (time: number) => {
      frame = 0;
      if (dead || document.hidden || !visible || !scene) return;
      const { reduced: still, headTurn: fixed, hover: leaning } = options.current;
      const seconds = time / 1000;
      const cycle = seconds % 5;
      const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
      const turn = fixed === "left" ? -1 : fixed === "right" ? 1 : fixed === "centre" || still ? 0 :
        cycle < 1.5 ? -1 : cycle < 2.5 ? -1 + 2 * smooth(cycle - 1.5) : cycle < 4 ? 1 : 1 - 2 * smooth(cycle - 4);
      // Cap redraws to 30 fps; reduced-motion renders only when props/hover change.
      if (!still && time - previous < 33) { frame = requestAnimationFrame(loop); return; }
      previous = time;
      scene.draw(seconds, turn, leaning, !still);
      if (!still) frame = requestAnimationFrame(loop);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      if (!dead && !document.hidden && visible && scene) frame = requestAnimationFrame(loop);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); else cancelAnimationFrame(frame); });
    observer.observe(container);
    const start = () => {
      import("./bobPeekScene").then(({ createPeekScene }) => createPeekScene(hands)).then((created) => {
        if (dead) { created.dispose(); return; }
        scene = created;
        container.appendChild(created.element);
        resize();
        resume();
      }).catch((error) => { if (!dead) console.error("Bob peek scene failed", error); });
    };
    // Neither the three.js chunk nor the decoder/model request precedes first paint.
    const afterLoad = () => {
      // `"requestIdleCallback" in window` narrows window to never (Safari lacks it)
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start);
      else timeout = setTimeout(start, 200);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    window.addEventListener("resize", resize);
    container.addEventListener("peek-redraw", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      dead = true;
      window.removeEventListener("load", afterLoad);
      window.removeEventListener("resize", resize);
      container.removeEventListener("peek-redraw", resume);
      document.removeEventListener("visibilitychange", resume);
      observer.disconnect();
      if (idle) window.cancelIdleCallback(idle);
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      scene?.element.remove();
      scene?.dispose();
    };
  }, [desktop, expanded, hands]);
  // Frozen review modes and hover still redraw when motion is disabled.
  useEffect(() => {
    if (!expanded && desktop) host.current?.dispatchEvent(new Event("peek-redraw"));
  }, [headTurn, hover, reduced, expanded, desktop]);

  if (!desktop) return null;
  if (expanded) return (
    <div style={{ position: "fixed", bottom: 0, right: 12, width: 240, zIndex: 80 }}>
      <StrumPlayer width={240} reduced={reduced} />
      <button type="button" onClick={() => setExpanded(false)} aria-label="Return Bob to peeking" style={{ position: "absolute", right: 4, top: 4, width: 38, height: 38, border: 0, borderRadius: "50%", color: "#263d48", background: "#e4eeef", fontSize: 26, cursor: "pointer" }}>×</button>
    </div>
  );
  return (
    <button type="button" aria-label="Watch Bob strum his guitar" onClick={() => setExpanded(true)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ position: "fixed", right: 0, bottom: "13vh", width: 320, height: 410, zIndex: 80, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
      <div ref={host} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
    </button>
  );
}
