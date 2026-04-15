import { useRef, useEffect } from "react";
import useIsDesktop from "../hooks/useIsDesktop";

/* ── colour palette (from site theme) ── */
const PALETTE = [
  [255, 136, 34],   // orange  #ff8822  (--color-bg / #f82)
  [240, 235, 228],  // cream   #f0ebe4  (--color-surface)
  [75, 189, 255],   // blue    rgb(75, 189, 255) (--color-accent)
] as const;

/* ── splotch tuning ── */
const MIN_SPLOTCHES = 4;
const MAX_SPLOTCHES = 6;
const SPAWN_MIN_MS = 3_000;
const SPAWN_MAX_MS = 6_000;
const LIFETIME_MIN_FRAMES = 180;   // 6s  @ 30 fps
const LIFETIME_MAX_FRAMES = 420;   // 14s @ 30 fps
const PATHS_PER_SPLOTCH_MIN = 20;
const PATHS_PER_SPLOTCH_MAX = 40;
const CONTENT_WIDTH = 680;
const MARGIN_OVERLAP = 40;
const TOP_STRIP = 150;
const BOTTOM_STRIP = 150;
const NOISE_SCALE = 0.005;
const PATH_STEPS = 12;
const MAX_OPACITY = 0.40;
const MIN_OPACITY = 0.15;

interface Splotch {
  x: number;
  y: number;
  size: number;
  color: readonly [number, number, number];
  maxOpacity: number;
  age: number;
  lifetime: number;
  seed: number;
  pathCount: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export default function GenerativeSwirls() {
  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDesktop || !containerRef.current) return;

    let cancelled = false;
    let p5Instance: import("p5").default | null = null;
    let spawnTimer: ReturnType<typeof setTimeout> | null = null;
    let visibilityHandler: (() => void) | null = null;

    import("p5").then((mod) => {
      if (cancelled || !containerRef.current) return;

      const p5Constructor = mod.default as unknown as new (
        sketch: (p: import("p5").default) => void,
        node: HTMLElement,
      ) => import("p5").default;

      const splotches: Splotch[] = [];
      let running = false;

      function pickSpawnPosition(p: import("p5").default): [number, number] {
        const colLeft = (p.width - CONTENT_WIDTH) / 2;
        const colRight = colLeft + CONTENT_WIDTH;

        const zones: Array<() => [number, number]> = [
          // left gutter
          () => [randomBetween(0, colLeft + MARGIN_OVERLAP), randomBetween(0, p.height)],
          // right gutter
          () => [randomBetween(colRight - MARGIN_OVERLAP, p.width), randomBetween(0, p.height)],
          // top strip
          () => [randomBetween(0, p.width), randomBetween(0, TOP_STRIP)],
          // bottom strip
          () => [randomBetween(0, p.width), randomBetween(p.height - BOTTOM_STRIP, p.height)],
        ];

        return zones[Math.floor(Math.random() * zones.length)]();
      }

      function spawnSplotch(p: import("p5").default) {
        if (splotches.length >= MAX_SPLOTCHES) return;
        const [x, y] = pickSpawnPosition(p);
        splotches.push({
          x,
          y,
          size: randomBetween(80, 200),
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          maxOpacity: randomBetween(MIN_OPACITY, MAX_OPACITY),
          age: 0,
          lifetime: Math.floor(randomBetween(LIFETIME_MIN_FRAMES, LIFETIME_MAX_FRAMES)),
          seed: Math.random() * 1000,
          pathCount: Math.floor(randomBetween(PATHS_PER_SPLOTCH_MIN, PATHS_PER_SPLOTCH_MAX)),
        });
      }

      function scheduleSpawn(p: import("p5").default) {
        const delay = randomBetween(SPAWN_MIN_MS, SPAWN_MAX_MS);
        spawnTimer = setTimeout(() => {
          if (cancelled) return;
          if (splotches.length < MIN_SPLOTCHES) {
            const burst = MIN_SPLOTCHES - splotches.length;
            for (let i = 0; i < burst; i++) spawnSplotch(p);
          } else {
            spawnSplotch(p);
          }
          if (!running) {
            running = true;
            p.loop();
          }
          scheduleSpawn(p);
        }, delay);
      }

      function drawSplotch(p: import("p5").default, s: Splotch) {
        const progress = s.age / s.lifetime;
        let fade: number;
        if (progress < 0.15) {
          fade = progress / 0.15;
        } else if (progress > 0.60) {
          fade = 1 - (progress - 0.60) / 0.40;
        } else {
          fade = 1;
        }
        const opacity = s.maxOpacity * Math.max(0, fade);
        if (opacity <= 0) return;

        const [r, g, b] = s.color;
        const timeSeed = s.seed + s.age * 0.003;

        p.noFill();

        for (let i = 0; i < s.pathCount; i++) {
          const angle0 = (i / s.pathCount) * p.TWO_PI;
          const jitter = randomBetween(0, s.size * 0.2);
          let px = s.x + Math.cos(angle0) * jitter;
          let py = s.y + Math.sin(angle0) * jitter;

          const baseWeight = randomBetween(1.5, 4);
          p.stroke(r, g, b, opacity * 255);

          p.beginShape();
          p.splineVertex(px, py);
          p.splineVertex(px, py);

          for (let step = 0; step < PATH_STEPS; step++) {
            const noiseAngle =
              p.noise(px * NOISE_SCALE, py * NOISE_SCALE, timeSeed + i * 0.1) *
              p.TWO_PI * 2;
            const stepLen = s.size / PATH_STEPS;
            px += Math.cos(noiseAngle) * stepLen;
            py += Math.sin(noiseAngle) * stepLen;

            const taper = 1 - step / PATH_STEPS;
            p.strokeWeight(baseWeight * fade * taper);
            p.splineVertex(px, py);
          }

          p.splineVertex(px, py);
          p.endShape();
        }
      }

      const sketch = (p: import("p5").default) => {
        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight);
          p.frameRate(30);
          p.noLoop();
          running = false;
          scheduleSpawn(p);
        };

        p.draw = () => {
          p.clear();

          for (let i = splotches.length - 1; i >= 0; i--) {
            const s = splotches[i];
            s.age++;
            if (s.age >= s.lifetime) {
              splotches.splice(i, 1);
              continue;
            }
            drawSplotch(p, s);
          }

          if (splotches.length === 0) {
            running = false;
            p.noLoop();
          }
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
      };

      p5Instance = new p5Constructor(sketch, containerRef.current!);

      visibilityHandler = () => {
        if (!p5Instance) return;
        if (document.hidden) {
          p5Instance.noLoop();
        } else if (splotches.length > 0) {
          running = true;
          p5Instance.loop();
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);

      // store full cleanup so the effect teardown can call it
      cleanupRef.current = () => {
        if (spawnTimer) clearTimeout(spawnTimer);
        if (visibilityHandler) {
          document.removeEventListener("visibilitychange", visibilityHandler);
        }
        if (p5Instance) {
          p5Instance.remove();
          p5Instance = null;
        }
      };
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
