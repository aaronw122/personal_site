// Plays a strum sprite sheet on the same clock as the Bob tuner's live
// preview: phase = (seconds % loop) / loop, frame = phase * frames.
// strum.json carries the tuner's current loop length and the sheet layout
// (every musician's sheet is exported with the same 80-frame 10-column grid),
// so every player strums at the tuner's speed, in step with the others.
import { useEffect, useRef, useState } from "react";

type StrumManifest = { frames: number; cols: number; frameWidth: number; frameHeight: number; loopSeconds: number };

type Props = {
  width: number;
  reduced: boolean;
  /** Sprite sheet laid out as strum.json describes; defaults to Bob Weir's. */
  src?: string;
  label?: string;
};

export default function StrumPlayer({ width, reduced, src = "/images/bob/strum-sheet.webp", label = "Bob Weir strumming his guitar" }: Props) {
  const [sheet, setSheet] = useState<StrumManifest | null>(null);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    // no-cache: pick up a loop length changed in the tuner since the last click.
    // SAFETY: strum.json is written only by the Bob tuner's export (serve.ts), always with the StrumManifest shape.
    fetch("/images/bob/strum.json", { cache: "no-cache" })
      .then((r) => r.json() as Promise<StrumManifest>)
      .then((manifest) => {
        if (live) setSheet(manifest);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const node = el.current;
    if (!sheet || !node) return;
    const scale = width / sheet.frameWidth;
    let raf = 0;
    const tick = (t: number) => {
      const i = reduced ? 0 : Math.floor((((t / 1000) % sheet.loopSeconds) / sheet.loopSeconds) * sheet.frames);
      node.style.backgroundPosition = `${-(i % sheet.cols) * sheet.frameWidth * scale}px ${-Math.floor(i / sheet.cols) * sheet.frameHeight * scale}px`;
      if (!reduced) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheet, width, reduced]);

  if (!sheet) return null;
  const scale = width / sheet.frameWidth;
  const rows = Math.ceil(sheet.frames / sheet.cols);
  return (
    <div
      ref={el}
      role="img"
      aria-label={label}
      style={{
        width,
        height: sheet.frameHeight * scale,
        backgroundImage: `url(${src})`,
        backgroundSize: `${sheet.cols * sheet.frameWidth * scale}px ${rows * sheet.frameHeight * scale}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
