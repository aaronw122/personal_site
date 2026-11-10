import { useEffect, useRef, type MutableRefObject } from "react";
import { PEEK_BOTTOM, PEEK_BOX as BOX, PEEK_OUT } from "./stageLayout";

const hiddenOffset = 81;
const leanOut = 2.5;
const popMs = 974;
const SWAY = { degrees: 1.5, ms: 5000 } as const;
const BREATH = { px: 0.6, ms: 3700 } as const;
const PERK = { degrees: -2.5, px: 1.5, inMs: 220, outMs: 400 } as const;

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const slope =
        3 * x1 * (1 - t) * (1 - 3 * t) + 3 * x2 * t * (2 - 3 * t) + 3 * t * t;
      if (Math.abs(slope) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - (at(x1, x2, t) - x) / slope));
    }
    return at(y1, y2, t);
  };
}
const perkIn = cubicBezier(0.34, 1.56, 0.64, 1);
const perkOut = cubicBezier(0.42, 0, 0.58, 1);
export type PeekPose = { angle: number; rise: number };

function peekImages(id: string) {
  const base = `/avatars/${encodeURIComponent(id)}`;
  return { body: `${base}/peek-body.webp`, hands: `${base}/peek-hands.webp` };
}

function EdgeFill({ src }: { src: string }) {
  const width = PEEK_OUT + 6;
  return (
    <span
      style={{
        position: "absolute",
        top: 0,
        left: "100%",
        width,
        height: "100%",
        backgroundImage: `url(${src})`,
        backgroundSize: `${2 * BOX.width * width}px 100%`,
        backgroundPosition: "right",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export function preloadPeek(id: string) {
  const images = peekImages(id);
  for (const src of [images.body, images.hands]) {
    const image = new Image();
    image.src = src;
    void image.decode().catch(() => undefined);
  }
}

type Props = {
  avatarId: string;
  reduced: boolean;
  hovered: boolean;
  onActivate: () => void | Promise<void>;
  onHover?: (active: boolean) => void;
  pose?: MutableRefObject<PeekPose>;
};
export default function PeekSprite({
  avatarId,
  reduced,
  hovered,
  onActivate,
  onHover,
  pose,
}: Props) {
  const host = useRef<HTMLButtonElement>(null);
  const movingRef = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLImageElement>(null);
  const hoveredRef = useRef(hovered);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);
  const images = peekImages(avatarId);

  useEffect(() => {
    const element = host.current;
    const movingLayer = movingRef.current;
    const art = body.current;
    if (!element || !movingLayer || !art || reduced) return;
    let frame = 0;
    let visible = true;
    let dead = false;
    let ready = false;
    let startedAt = 0;
    let perk = 0,
      perkFrom = 0,
      perkSince = 0,
      perkOn = false;
    movingLayer.style.transform = `translateX(${hiddenOffset}px)`;
    const draw = (now: number) => {
      frame = 0;
      if (document.hidden || !visible) return;
      startedAt ||= now;
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / popMs);
      const eased = progress * progress * (3 - 2 * progress);
      const pop = hiddenOffset * (1 - eased);
      if (hoveredRef.current !== perkOn) {
        perkOn = hoveredRef.current;
        perkFrom = perk;
        perkSince = now;
      }
      const perkTime = (now - perkSince) / (perkOn ? PERK.inMs : PERK.outMs);
      perk =
        perkTime >= 1
          ? +perkOn
          : perkFrom +
            (+perkOn - perkFrom) * (perkOn ? perkIn : perkOut)(perkTime);
      const rest = progress === 1 ? elapsed - popMs : 0;
      const angle =
        (progress === 1
          ? Math.sin((rest / SWAY.ms) * Math.PI * 2) * SWAY.degrees
          : 0) +
        PERK.degrees * perk;
      const rise =
        (progress === 1
          ? -BREATH.px *
            (0.5 - 0.5 * Math.cos((rest / BREATH.ms) * Math.PI * 2))
          : 0) -
        PERK.px * perk;
      movingLayer.style.transform = `translateX(${pop.toFixed(2)}px) translateY(${rise.toFixed(3)}px) rotate(${angle.toFixed(3)}deg)`;
      if (pose) {
        pose.current.angle = angle;
        pose.current.rise = rise;
      }
      frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      if (ready && !document.hidden && visible)
        frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resume();
      else cancelAnimationFrame(frame);
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", resume);
    art
      .decode()
      .catch(() => undefined)
      .then(() => {
        ready = true;
        if (!dead) resume();
      });
    return () => {
      dead = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      cancelAnimationFrame(frame);
    };
  }, [avatarId, reduced, pose]);

  const lean = (hovered ? 0 : leanOut) - PEEK_OUT;
  return (
    <button
      data-testid="stage-peek"
      ref={host}
      type="button"
      aria-label="Watch musician strum a guitar"
      onClick={onActivate}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{
        position: "fixed",
        right: 0,
        bottom: PEEK_BOTTOM,
        width: BOX.width,
        height: BOX.height,
        zIndex: 80,
        padding: 0,
        border: 0,
        overflow: "hidden",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${lean}px)`,
          transition: reduced ? "none" : "transform 320ms ease-out",
          pointerEvents: "none",
        }}
      >
        <span
          ref={movingRef}
          key={avatarId}
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "100% 66%",
            willChange: reduced ? "auto" : "transform",
          }}
        >
          <img
            ref={body}
            src={images.body}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "fill",
            }}
          />
          <EdgeFill src={images.body} />
        </span>
        <img
          src={images.hands}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
          }}
        />
        <EdgeFill src={images.hands} />
      </span>
    </button>
  );
}
