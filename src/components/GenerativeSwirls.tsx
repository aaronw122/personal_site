import { useRef, useEffect } from "react";
import useIsDesktop from "../hooks/useIsDesktop";

/* ── colour palette (from site theme) ── */
const PALETTE = [
  [255, 136, 34],   // orange  #ff8822  (--color-bg / #f82)
  [75, 189, 255],   // blue    rgb(75, 189, 255) (--color-accent)
] as const;

/* ── splotch tuning ── */
const MIN_SPLOTCHES = 2;
const MAX_SPLOTCHES = 3;
const SPAWN_MIN_MS = 3_000;
const SPAWN_MAX_MS = 6_000;
const LIFETIME_MIN_FRAMES = 180;   // 6s  @ 30 fps
const LIFETIME_MAX_FRAMES = 420;   // 14s @ 30 fps
const CONTENT_WIDTH = 680;
const MARGIN_OVERLAP = 40;
const SPIRAL_TURNS = 3;
const BLOBS_PER_TURN = 14;
const MAX_OPACITY = 0.65;
const MIN_OPACITY = 0.30;

interface Splotch {
  x: number;
  y: number;
  size: number;
  color: readonly [number, number, number];
  maxOpacity: number;
  age: number;
  lifetime: number;
  seed: number;
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
        ];

        return zones[Math.floor(Math.random() * zones.length)]();
      }

      function spawnSplotch(p: import("p5").default) {
        if (splotches.length >= MAX_SPLOTCHES) return;
        const [x, y] = pickSpawnPosition(p);
        splotches.push({
          x,
          y,
          size: randomBetween(50, 80),
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          maxOpacity: randomBetween(MIN_OPACITY, MAX_OPACITY),
          age: 0,
          lifetime: Math.floor(randomBetween(LIFETIME_MIN_FRAMES, LIFETIME_MAX_FRAMES)),
          seed: Math.random() * 1000,
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
        const rotation = -progress * p.TWO_PI;

        p.noStroke();

        const totalBlobs = SPIRAL_TURNS * BLOBS_PER_TURN;

        p.noStroke();

        for (let i = 0; i < totalBlobs; i++) {
          const t = i / totalBlobs;

          const angle = -t * SPIRAL_TURNS * p.TWO_PI + rotation;
          const baseRadius = t * s.size;

          const noiseVal = p.noise(t * 2 + s.seed, 0, s.seed);
          const displacement = (noiseVal - 0.5) * s.size * 0.25;
          const radius = baseRadius + displacement;

          const bx = s.x + Math.cos(angle) * radius;
          const by = s.y + Math.sin(angle) * radius;

          const blobSize = (4 + t * s.size * 0.15) * (0.7 + p.noise(i + s.seed) * 0.6);

          for (let layer = 3; layer >= 0; layer--) {
            const layerScale = 1 + layer * 0.4;
            const layerAlpha = opacity * 255 * (0.15 - layer * 0.03);
            p.fill(r, g, b, layerAlpha);
            p.ellipse(bx, by, blobSize * layerScale, blobSize * layerScale);
          }
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
      className="fixed inset-0 -z-1 pointer-events-none"
      aria-hidden="true"
    />
  );
}
