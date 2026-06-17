import { useCallback, useEffect, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";
import "./Era.css";

/* Engraved corner flourish — drawn once, mirrored into all four corners.
   Loosely inspired by the LIFE "Noble Note" cover. */
function CoverFrame() {
  return (
    <svg
      className="era-cover-frame"
      viewBox="0 0 400 560"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <g
          id="era-corner"
          fill="none"
          stroke="#3a2a17"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {/* main sweep linking top edge to left edge */}
          <path d="M150,40 C104,40 72,46 58,76 C50,94 54,114 72,122" />
          {/* inner scroll spiral */}
          <path d="M72,122 C86,124 98,116 98,102 C98,92 90,86 82,88 C76,90 75,98 81,100" />
          <circle cx="81" cy="100" r="2.2" fill="#3a2a17" stroke="none" />
          {/* tendril curling toward the corner */}
          <path d="M58,76 C42,72 36,56 42,44 C47,34 58,32 64,40" />
          {/* small leaf accents on each edge */}
          <path d="M150,40 C140,27 123,25 115,36" />
          <path d="M40,150 C27,140 25,123 36,115" />
          {/* fine diagonal flick at the very corner */}
          <path d="M30,30 C40,38 44,46 44,56" />
        </g>
      </defs>

      {/* double rule frame */}
      <rect x="16" y="16" width="368" height="528" fill="none" stroke="#3a2a17" strokeWidth="2.5" />
      <rect x="23" y="23" width="354" height="514" fill="none" stroke="#3a2a17" strokeWidth="1" />
      {/* slim inner keyline around the title block */}
      <rect x="52" y="150" width="296" height="260" fill="none" stroke="#3a2a17" strokeWidth="0.8" opacity="0.55" />

      {/* four mirrored corners */}
      <use href="#era-corner" />
      <use href="#era-corner" transform="translate(400,0) scale(-1,1)" />
      <use href="#era-corner" transform="translate(0,560) scale(1,-1)" />
      <use href="#era-corner" transform="translate(400,560) scale(-1,-1)" />

      {/* top & bottom center fleurons */}
      <g fill="#3a2a17">
        <path d="M200,28 l8,8 l-8,8 l-8,-8 z" />
        <path d="M200,524 l8,8 l-8,8 l-8,-8 z" />
      </g>
    </svg>
  );
}

/* One transparent PNG per page, laid over the solid paper. Until the artwork
   exists, it falls back to a labelled placeholder (or the original text), so the
   notebook stays reviewable. Drop the files into /public/era/. */
function PageImage({ src, label, children }: { src: string; label: string; children?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const file = src.replace("/era/", "");

  if (failed) {
    if (children) {
      return (
        <div className="era-page-inner era-page-inner--scroll era-hand">
          {children}
          <p className="era-media-note">image pending — {file}</p>
        </div>
      );
    }
    return (
      <div className="era-media-placeholder">
        <span className="era-media-label">{label}</span>
        <code>{file}</code>
      </div>
    );
  }
  return <img className="era-media-img" src={src} alt={label} onError={() => setFailed(true)} />;
}

const CoverContent = (
  <>
    <CoverFrame />
    <div className="era-cover-text">
      <div className="era-cover-brand">era</div>
      <div className="era-cover-rule" />
      <div className="era-cover-qty">2 devices</div>
    </div>
  </>
);

type Leaf = {
  front: ReactNode;
  back: ReactNode;
  frontClass: string;
  backClass: string;
  frontLabel: string;
  backLabel: string;
};

const LEAVES: Leaf[] = [
  {
    // cover / inside front cover
    front: CoverContent,
    back: null,
    frontClass: "era-cover",
    backClass: "era-inside-cover",
    frontLabel: "open the notebook",
    backLabel: "close the notebook",
  },
  {
    // intro (right) / quill device sketch (back → left of quill spread)
    front: (
      <PageImage src="/era/intro.png" label="intro">
        <p>
          over the years, we've been conditioned to use our phones and computers
          in unhealthy ways. it's difficult for me to use my phone without a
          subconscious pull towards dopamine — checking imessage, discord,
          twitter, other channels in my life. even if i pull my phone out to
          check my commute home, i might end up down a rabbit hole when i should
          instead be present in the moment.
        </p>
        <p>
          both of the devices i showcase touch on this theme and would help me
          capture a new sense of presence in the world and my work.
        </p>
      </PageImage>
    ),
    back: <PageImage src="/era/quill-device.png" label="quill — device" />,
    frontClass: "era-page",
    backClass: "era-page",
    frontLabel: "turn to the quill spread",
    backLabel: "back to the intro",
  },
  {
    // quill writing (right) / tiger device sketch (back → left of tiger spread)
    front: (
      <PageImage src="/era/quill-writing.png" label="quill — writing">
        <h2 className="era-quill-title">quill</h2>
        <p>
          you are most in tune with a pen in your hand — writing thoughts and
          ideas down, away from the noise of your digital devices. this brings a
          sense of calm you don't feel otherwise, as if you are walking down a
          trail with nothing but appreciation for your surroundings — the trickle
          of the water, the leaves that ruffle in your wake, and the feeling of
          touching a smooth stone.
        </p>
        <p>
          quill is your intellectual thought partner. she helps you learn new
          things, and get shit done where you are most present — pen and paper.
        </p>
        <p>
          quill traces your pen strokes for context, takes in your voice, and
          outputs feedback when prompted. quill is like if you had aristotle in
          your pocket — tracking your learning and thought patterns over time,
          identifying your style, and areas for development.
        </p>
        <p>having a way to access intelligence away from the noise is special — you deserve it.</p>
      </PageImage>
    ),
    back: <PageImage src="/era/tiger-device.png" label="tiger — device" />,
    frontClass: "era-page",
    backClass: "era-page",
    frontLabel: "turn to the tiger spread",
    backLabel: "back to the quill spread",
  },
  {
    // tiger writing (right) / blank end page
    front: <PageImage src="/era/tiger-writing.png" label="tiger — writing" />,
    back: null,
    frontClass: "era-page",
    backClass: "era-page",
    frontLabel: "tiger spread",
    backLabel: "back to the tiger spread",
  },
];

const PAGES = LEAVES.length - 1; // closed (0) → one state per leaf turned

function initialPage(): number {
  if (typeof window === "undefined") return 0;
  const p = parseInt(new URLSearchParams(window.location.search).get("p") || "", 10);
  return Number.isFinite(p) ? Math.max(0, Math.min(PAGES, p)) : 0;
}

export default function Era() {
  usePageTitle("era");
  const [page, setPage] = useState(initialPage);
  // the leaf currently mid-flip — kept on top until its transition ends so the
  // turning sheet never slips behind the destination page.
  const [turning, setTurning] = useState<number | null>(null);

  const next = useCallback(
    () => setPage((p) => { const t = Math.min(PAGES, p + 1); if (t !== p) setTurning(p); return t; }),
    [],
  );
  const prev = useCallback(
    () => setPage((p) => { const t = Math.max(0, p - 1); if (t !== p) setTurning(t); return t; }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // a leaf is "flipped" once we've turned past it
  const flipped = (leaf: number) => page > leaf;
  // resting stack: unflipped leaves descend (cover on top); flipped leaves
  // ascend (most-recently-turned on top). The turning leaf floats above all.
  const zFor = (leaf: number) =>
    turning === leaf ? 200 : flipped(leaf) ? 100 + leaf : 100 + LEAVES.length - leaf;
  const endTurn = (leaf: number) => (e: ReactTransitionEvent) => {
    if (e.propertyName === "transform" && turning === leaf) setTurning(null);
  };

  const tap = (fn: () => void, label: string) => ({
    onClick: fn,
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
    },
    role: "button",
    tabIndex: 0,
    "aria-label": label,
  });

  return (
    <div className="era-stage">
      <Link to="/" className="era-back">← awill.co</Link>

      <div className={`era-book${page === 0 ? " is-closed" : ""}`}>
        {/* static base pages behind the flipping leaves */}
        <div className="era-page-base era-page-base--left" />
        <div className="era-page-base era-page-base--right" />

        {LEAVES.map((leaf, i) => (
          <div
            key={i}
            className="era-leaf"
            onTransitionEnd={endTurn(i)}
            style={{
              zIndex: zFor(i),
              transform: flipped(i) ? "rotateY(-180deg)" : "rotateY(0deg)",
            }}
          >
            <div className={`era-face era-face--front ${leaf.frontClass}`} {...tap(next, leaf.frontLabel)}>
              {leaf.front}
            </div>
            <div className={`era-face era-face--back ${leaf.backClass}`} {...tap(prev, leaf.backLabel)}>
              {leaf.back}
            </div>
          </div>
        ))}
      </div>

      {/* navigation */}
      <div className="era-nav">
        <button onClick={prev} disabled={page === 0} aria-label="previous page">‹</button>
        <span className="era-nav-dots" aria-hidden="true">
          {Array.from({ length: PAGES + 1 }).map((_, i) => (
            <span key={i} className={`era-dot${i === page ? " is-active" : ""}`} />
          ))}
        </span>
        <button onClick={next} disabled={page === PAGES} aria-label="next page">›</button>
      </div>
    </div>
  );
}
