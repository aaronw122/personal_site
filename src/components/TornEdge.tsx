import React, { useMemo } from "react";
import { createNoise2D } from "simplex-noise";

function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    const n = 80;

    for (let i = 0; i <= n; i++) {
      const xPct = (i / n) * 100;
      const broad = noise(i * 0.08, 0);
      const fine = noise(i * 0.3, 0);
      const fiber = noise(i * 1.2, 0.5);
      const yPct = 0.5 + (broad + 1) * 1.8 + fine * 0.7 + fiber * 0.4;
      pts.push(`${xPct.toFixed(2)}% ${Math.max(0, yPct).toFixed(2)}%`);
    }

    for (let i = 1; i < n; i++) {
      const yPct = (i / n) * 100;
      const broad = noise(i * 0.08, 1);
      const fine = noise(i * 0.3, 1);
      const fiber = noise(i * 1.2, 1.5);
      const xPct = 100 - (0.5 + (broad + 1) * 1.2 + fine * 0.5 + fiber * 0.3);
      pts.push(`${xPct.toFixed(2)}% ${yPct.toFixed(2)}%`);
    }

    for (let i = n; i >= 0; i--) {
      const xPct = (i / n) * 100;
      const broad = noise(i * 0.08, 2);
      const fine = noise(i * 0.3, 2);
      const fiber = noise(i * 1.2, 2.5);
      const yPct = 100 - (0.5 + (broad + 1) * 1.8 + fine * 0.7 + fiber * 0.4);
      pts.push(`${xPct.toFixed(2)}% ${Math.min(100, yPct).toFixed(2)}%`);
    }

    pts.push("0% 0%");

    return `polygon(${pts.join(", ")})`;
  }, [seed]);

  return { clipPath };
}

const STRIP_WIDTH = 24;
const HOLE_SPACING = 23;
const VIEWBOX_HEIGHT = 280;

interface TornEdgeProps {
  seed: string;
}

export default function TornEdge({ seed }: TornEdgeProps) {
  const pathData = useMemo(() => {
    const hash = hashString(seed);
    const rng = seededRandom(hash);
    const noise = createNoise2D(rng);

    const holeCount = Math.floor(VIEWBOX_HEIGHT / HOLE_SPACING);
    const firstHole = 14;

    const points: string[] = [];

    points.push(`M${STRIP_WIDTH},0`);

    points.push(`L${STRIP_WIDTH},${VIEWBOX_HEIGHT}`);

    const step = 1.5;
    for (let y = VIEWBOX_HEIGHT; y >= 0; y -= step) {
      let minHoleDist = Infinity;
      for (let h = 0; h < holeCount + 1; h++) {
        const holeY = firstHole + h * HOLE_SPACING;
        minHoleDist = Math.min(minHoleDist, Math.abs(y - holeY));
      }

      const holeInfluence = Math.max(0, 1 - minHoleDist / (HOLE_SPACING * 0.4));

      const broad = noise(y * 0.04, hash * 0.01);
      const fine = noise(y * 0.25, hash * 0.01);

      const inwardX = 8 + holeInfluence * 3;
      const baseX = 6 + broad * 1.5;
      const jag = fine * 1.2;
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
      <path d={pathData} fill="#faf6f0" />
    </svg>
  );
}
