import React, { useMemo } from "react";
import { createNoise2D } from "simplex-noise";

// Simple seeded PRNG (mulberry32)
function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a number for seeding
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function useTornClip(seed: string): React.CSSProperties {
  const clipPath = useMemo(() => {
    const hash = hashString(seed + "-clip");
    const rng = seededRandom(hash);
    const noise = createNoise2D(rng);

    const pts: string[] = [];
    const n = 80; // many points for fibrous texture

    // Top edge: left to right — curves inward only (y > 0)
    for (let i = 0; i <= n; i++) {
      const xPct = (i / n) * 100;
      const broad = noise(i * 0.08, 0);
      const fine = noise(i * 0.3, 0);
      const fiber = noise(i * 1.2, 0.5); // ultra-fine paper fibers
      const yPct = 0.5 + (broad + 1) * 1.8 + fine * 0.7 + fiber * 0.4;
      pts.push(`${xPct.toFixed(2)}% ${Math.max(0, yPct).toFixed(2)}%`);
    }

    // Right edge: top to bottom — curves inward only (x < 100)
    for (let i = 1; i < n; i++) {
      const yPct = (i / n) * 100;
      const broad = noise(i * 0.08, 1);
      const fine = noise(i * 0.3, 1);
      const fiber = noise(i * 1.2, 1.5);
      const xPct = 100 - (0.5 + (broad + 1) * 1.2 + fine * 0.5 + fiber * 0.3);
      pts.push(`${xPct.toFixed(2)}% ${yPct.toFixed(2)}%`);
    }

    // Bottom edge: right to left — curves inward only (y < 100)
    for (let i = n; i >= 0; i--) {
      const xPct = (i / n) * 100;
      const broad = noise(i * 0.08, 2);
      const fine = noise(i * 0.3, 2);
      const fiber = noise(i * 1.2, 2.5);
      const yPct = 100 - (0.5 + (broad + 1) * 1.8 + fine * 0.7 + fiber * 0.4);
      pts.push(`${xPct.toFixed(2)}% ${Math.min(100, yPct).toFixed(2)}%`);
    }

    // Left edge: straight (TornEdge SVG handles the visual)
    pts.push("0% 0%");

    return `polygon(${pts.join(", ")})`;
  }, [seed]);

  return { clipPath };
}

const STRIP_WIDTH = 24;
const HOLE_SPACING = 23; // Must match mask-size y-value in .notebook-card (index.css)
const VIEWBOX_HEIGHT = 280; // fixed viewBox, stretches to fit

interface TornEdgeProps {
  seed: string;
}

export default function TornEdge({ seed }: TornEdgeProps) {
  const pathData = useMemo(() => {
    const hash = hashString(seed);
    const rng = seededRandom(hash);
    const noise = createNoise2D(rng);

    // Number of holes that fit in viewBox
    const holeCount = Math.floor(VIEWBOX_HEIGHT / HOLE_SPACING);
    const firstHole = 14; // first hole Y offset

    // Generate torn left edge points
    const points: string[] = [];

    // Start at top-right
    points.push(`M${STRIP_WIDTH},0`);

    // Down the right edge (straight)
    points.push(`L${STRIP_WIDTH},${VIEWBOX_HEIGHT}`);

    // Up the left edge (torn) — bottom to top
    // Smaller step + two noise frequencies = jagged, fibrous look
    const step = 1.5;
    for (let y = VIEWBOX_HEIGHT; y >= 0; y -= step) {
      // Find distance to nearest hole center
      let minHoleDist = Infinity;
      for (let h = 0; h < holeCount + 1; h++) {
        const holeY = firstHole + h * HOLE_SPACING;
        minHoleDist = Math.min(minHoleDist, Math.abs(y - holeY));
      }

      // Near holes: edge pulls inward (toward card body)
      const holeInfluence = Math.max(0, 1 - minHoleDist / (HOLE_SPACING * 0.4));

      // Two noise frequencies: broad shape + fine jaggedness
      const broad = noise(y * 0.04, hash * 0.01); // slow drift
      const fine = noise(y * 0.25, hash * 0.01);   // sharp jags

      // Base X: subtle range, mostly near 5-8px
      // Near holes: stays at ~8-10px (inward)
      // Between holes: drifts to 4-8px with fine jags
      const inwardX = 8 + holeInfluence * 3;
      const baseX = 6 + broad * 1.5; // 4.5 - 7.5
      const jag = fine * 1.2;         // ±1.2px jagged spikes
      const outwardX = baseX + jag;
      const x = holeInfluence > 0.3 ? inwardX : outwardX + holeInfluence * 3;

      points.push(`L${Math.max(0, Math.min(STRIP_WIDTH, x)).toFixed(1)},${y}`);
    }

    points.push("Z");
    return points.join(" ");
  }, [seed]);

  return (
    <svg
      className="torn-edge-svg"
      viewBox={`0 0 ${STRIP_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {/* Paper color — keep in sync with --color-paper in index.css */}
      <path d={pathData} fill="#faf6f0" />
    </svg>
  );
}
