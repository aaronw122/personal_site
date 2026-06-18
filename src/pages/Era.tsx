import { useEffect, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";
import "./Era.css";

// Synthesized page-turn sound (paper rustle) — no audio asset needed.
// Reuses one AudioContext, created lazily on the first page turn (a user gesture).
let _audioCtx: AudioContext | null = null;
function playPageTurn() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const dur = 0.34;

    // white-noise burst = the paper rustle
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 600;

    // bandpass sweep up-then-down mimics a page lifting and settling
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(1200, now);
    bp.frequency.exponentialRampToValueAtTime(4000, now + 0.1);
    bp.frequency.exponentialRampToValueAtTime(1800, now + dur);

    // two soft swells: the flick, then the settle
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);
  } catch {
    /* audio not available — silently skip */
  }
}

// device sketches stay as images (transparent, content-hashed)
import quillDeviceImg from "../era-art/quill-device.png";
import tigerDeviceImg from "../era-art/tiger-device.png";
// notebook writing is real text now — rendered live from the .md in a handwriting font
import rawMd from "@era-content/era/era devices 2.md?raw";

/* Engraved corner flourish — drawn once, mirrored into all four corners.
   Loosely inspired by the LIFE "Noble Note" cover. */
function CoverFrame() {
  return (
    <svg className="era-cover-frame" viewBox="0 0 400 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <g id="era-corner" fill="none" stroke="#3a2a17" strokeWidth="2" strokeLinecap="round">
          <path d="M150,40 C104,40 72,46 58,76 C50,94 54,114 72,122" />
          <path d="M72,122 C86,124 98,116 98,102 C98,92 90,86 82,88 C76,90 75,98 81,100" />
          <circle cx="81" cy="100" r="2.2" fill="#3a2a17" stroke="none" />
          <path d="M58,76 C42,72 36,56 42,44 C47,34 58,32 64,40" />
          <path d="M150,40 C140,27 123,25 115,36" />
          <path d="M40,150 C27,140 25,123 36,115" />
          <path d="M30,30 C40,38 44,46 44,56" />
        </g>
      </defs>
      <rect x="16" y="16" width="368" height="528" fill="none" stroke="#3a2a17" strokeWidth="2.5" />
      <rect x="23" y="23" width="354" height="514" fill="none" stroke="#3a2a17" strokeWidth="1" />
      <rect x="52" y="150" width="296" height="260" fill="none" stroke="#3a2a17" strokeWidth="0.8" opacity="0.55" />
      <use href="#era-corner" />
      <use href="#era-corner" transform="translate(400,0) scale(-1,1)" />
      <use href="#era-corner" transform="translate(0,560) scale(1,-1)" />
      <use href="#era-corner" transform="translate(400,560) scale(-1,-1)" />
      <g fill="#3a2a17">
        <path d="M200,28 l8,8 l-8,8 l-8,-8 z" />
        <path d="M200,524 l8,8 l-8,8 l-8,-8 z" />
      </g>
    </svg>
  );
}

const Art = ({ src, alt }: { src: string; alt: string }) => (
  <img className="era-media-img" src={src} alt={alt} />
);

// shared page content, authored once
const COVER: ReactNode = (
  <>
    <CoverFrame />
    <div className="era-cover-text">
      <div className="era-cover-brand">era</div>
      <div className="era-cover-rule" />
      <div className="era-cover-qty">2 devices</div>
    </div>
  </>
);
// split the .md into intro / quill / tiger writing, as plain paragraphs
function paragraphs(block: string): string[] {
  return block
    .replace(/!\[\[[^\]]+\]\]/g, "") // drop image embeds
    .split(/\n{2,}/) // blank line = paragraph break
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
const _quillSplit = rawMd.split(/^###\s+Quill\s*$/im);
const _tigerSplit = (_quillSplit[1] || "").split(/^###\s+Tiger\s*$/im);
const INTRO_PARAS = paragraphs(_quillSplit[0] || "");
const QUILL_PARAS = paragraphs(_tigerSplit[0] || "");
const TIGER_PARAS = paragraphs(_tigerSplit[1] || "");

const Writing = ({ paras }: { paras: string[] }) => (
  <div className="era-writing">
    {paras.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
);

const INTRO = <Writing paras={INTRO_PARAS} />;
const QUILL_DEVICE = <Art src={quillDeviceImg} alt="quill device sketch" />;
const QUILL_WRITING = <Writing paras={QUILL_PARAS} />;
const TIGER_DEVICE = <Art src={tigerDeviceImg} alt="tiger device sketch" />;
const TIGER_WRITING = <Writing paras={TIGER_PARAS} />;

type Leaf = { front: ReactNode; back: ReactNode; frontClass: string; backClass: string };

// desktop: a bound book, two-page spreads
const LEAVES: Leaf[] = [
  { front: COVER, back: null, frontClass: "era-cover", backClass: "era-inside-cover" },
  { front: INTRO, back: QUILL_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: QUILL_WRITING, back: TIGER_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: TIGER_WRITING, back: null, frontClass: "era-page", backClass: "era-page" },
];

// mobile: one page at a time, in reading order
const MOBILE: { content: ReactNode; cover?: boolean }[] = [
  { content: COVER, cover: true },
  { content: INTRO },
  { content: QUILL_DEVICE },
  { content: QUILL_WRITING },
  { content: TIGER_DEVICE },
  { content: TIGER_WRITING },
];

function useIsMobile() {
  const query = "(max-width: 700px)";
  const [m, setM] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setM(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return m;
}

function initialPage(maxPage: number): number {
  if (typeof window === "undefined") return 0;
  const p = parseInt(new URLSearchParams(window.location.search).get("p") || "", 10);
  return Number.isFinite(p) ? Math.max(0, Math.min(maxPage, p)) : 0;
}

export default function Era() {
  usePageTitle("era");
  const isMobile = useIsMobile();
  const total = isMobile ? MOBILE.length : LEAVES.length;
  const max = total - 1;

  const [page, setPage] = useState(() => initialPage(LEAVES.length - 1));
  // index of the leaf/page currently mid-flip — kept on top until its transition
  // ends so the turning sheet never slips behind the destination page.
  const [turning, setTurning] = useState<number | null>(null);
  // enable transitions only AFTER first paint, so the closed/centered layout
  // appears instantly instead of animating in from the un-translated state.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // clamp when the layout mode (and thus page count) changes
  useEffect(() => { setPage((p) => Math.min(p, max)); }, [max]);

  // play a page-turn sound whenever a flip begins (covers clicks, arrows,
  // taps and swipes — they all set `turning`)
  useEffect(() => {
    if (turning !== null) playPageTurn();
  }, [turning]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  const step = (dir: number) =>
    setPage((p) => {
      const t = Math.max(0, Math.min(max, p + dir));
      if (t !== p) setTurning(Math.min(p, t));
      return t;
    });

  const endTurn = (idx: number) => (e: ReactTransitionEvent) => {
    if (e.propertyName === "transform" && turning === idx) setTurning(null);
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

  // swipe support on mobile
  let touchX = 0;
  const onTouchStart = (e: ReactTouchEvent) => { touchX = e.changedTouches[0].clientX; };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx < -45) step(1);
    else if (dx > 45) step(-1);
  };

  return (
    <div className={`era-stage${ready ? " is-ready" : ""}`}>
      <Link to="/" className="era-back">← awill.co</Link>

      {isMobile ? (
        <div className="era-mobile" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {MOBILE.map((pg, i) => {
            const flipped = i < page;
            const z = turning === i ? 200 : flipped ? 100 + i : 100 + MOBILE.length - i;
            // once a page has finished turning, hide it so no "left page" /
            // spine line shows — mobile is strictly one page at a time
            const hidden = flipped && turning !== i;
            return (
              <div
                key={i}
                className="era-mpage"
                onTransitionEnd={endTurn(i)}
                style={{
                  zIndex: z,
                  transform: flipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                  visibility: hidden ? "hidden" : "visible",
                }}
              >
                <div className={`era-face era-face--front ${pg.cover ? "era-cover" : "era-page"}`} {...tap(() => step(1), "next page")}>
                  {pg.content}
                </div>
                <div className="era-face era-face--back era-page" {...tap(() => step(-1), "previous page")} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`era-book${page === 0 ? " is-closed" : ""}`}>
          <div className="era-page-base era-page-base--left" />
          <div className="era-page-base era-page-base--right" />
          {LEAVES.map((leaf, i) => {
            const flipped = page > i;
            const z = turning === i ? 200 : flipped ? 100 + i : 100 + LEAVES.length - i;
            return (
              <div
                key={i}
                className="era-leaf"
                onTransitionEnd={endTurn(i)}
                style={{ zIndex: z, transform: flipped ? "rotateY(-180deg)" : "rotateY(0deg)" }}
              >
                <div className={`era-face era-face--front ${leaf.frontClass}`} {...tap(() => step(1), "next page")}>
                  {leaf.front}
                </div>
                <div className={`era-face era-face--back ${leaf.backClass}`} {...tap(() => step(-1), "previous page")}>
                  {leaf.back}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="era-nav">
        <button onClick={() => step(-1)} disabled={page === 0} aria-label="previous page">‹</button>
        <span className="era-nav-dots" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`era-dot${i === page ? " is-active" : ""}`} />
          ))}
        </span>
        <button onClick={() => step(1)} disabled={page === max} aria-label="next page">›</button>
      </div>
    </div>
  );
}
