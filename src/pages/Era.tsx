import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  TouchEvent as ReactTouchEvent,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";
import "./Era.css";

import turnSound from "../era-art/page-turn.mp3";
let _audioCtx: AudioContext | null = null;
let _turnBuffer: AudioBuffer | null = null;
let _bufferLoading = false;
function ensureTurnAudio() {
  if (!_audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    _audioCtx = new Ctx();
    try {
      const session = (navigator as any).audioSession;
      if (session) session.type = "ambient";
    } catch {}
  }
  if (!_turnBuffer && !_bufferLoading) {
    _bufferLoading = true;
    fetch(turnSound)
      .then((r) => r.arrayBuffer())
      .then((buf) => _audioCtx!.decodeAudioData(buf))
      .then((decoded) => {
        _turnBuffer = decoded;
      })
      .catch(() => {})
      .finally(() => {
        _bufferLoading = false;
      });
  }
}
function playPageTurn() {
  try {
    ensureTurnAudio();
    if (!_audioCtx) return;
    if (_audioCtx.state === "suspended") void _audioCtx.resume();
    if (!_turnBuffer) return;
    const src = _audioCtx.createBufferSource();
    src.buffer = _turnBuffer;
    const gain = _audioCtx.createGain();
    gain.gain.value = 0.7;
    src.connect(gain).connect(_audioCtx.destination);
    src.start();
  } catch {}
}

import { WebHaptics } from "web-haptics";
let _haptics: WebHaptics | null = null;
function getHaptics(): WebHaptics | null {
  if (!_haptics) {
    try {
      _haptics = new WebHaptics();
    } catch {
      _haptics = null;
    }
  }
  return _haptics;
}
function playPageHaptic() {
  try {
    void getHaptics()?.trigger("soft");
  } catch {}
}

import quillDeviceImg from "../era-art/quill-device.png";
import tigerDeviceImg from "../era-art/tiger-device.png";
import rawMd from "@era-content/era/era devices 2.md?raw";

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

const COVER: ReactNode = (
  <>
    <div className="era-spine era-spine--left" aria-hidden="true" />
    <CoverFrame />
    <div className="era-cover-text">
      <div className="era-cover-brand">era</div>
      <div className="era-cover-rule" />
      <div className="era-cover-qty">2 devices</div>
    </div>
  </>
);

const BARCODE_BARS = [
  2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2,
  1, 3, 1, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 2,
];
function Barcode() {
  return (
    <div className="era-barcode" aria-hidden="true">
      <div className="era-barcode-bars">
        {BARCODE_BARS.map((w, i) => (
          <span key={i} style={{ width: w + "px", marginRight: ((i % 2) + 1) + "px" }} />
        ))}
      </div>
    </div>
  );
}

const BACK_COVER: ReactNode = (
  <div className="era-backcover">
    <div className="era-spine era-spine--right" aria-hidden="true" />
    <div className="era-backcover-tag">
      <Barcode />
      <div className="era-backcover-made">made in brooklyn</div>
    </div>
  </div>
);
type Block = { quote: boolean; text: string };
function blocks(section: string): Block[] {
  return section
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const quote = raw.startsWith(">");
      const text = (quote ? raw.replace(/^>\s?/gm, "") : raw)
        .replace(/\s*\n\s*/g, " ")
        .trim();
      return { quote, text };
    });
}
const _quillSplit = rawMd.split(/^###\s+Quill\s*$/im);
const _tigerSplit = (_quillSplit[1] || "").split(/^###\s+Tiger\s*$/im);
const INTRO_BLOCKS = blocks(_quillSplit[0] || "");
const QUILL_BLOCKS = blocks(_tigerSplit[0] || "");
const TIGER_BLOCKS = blocks(_tigerSplit[1] || "");

const pitchOf = (bs: Block[]) => bs.find((b) => b.quote)?.text ?? "";
const bodyOf = (bs: Block[]) => bs.filter((b) => !b.quote);
const QUILL_PITCH = pitchOf(QUILL_BLOCKS);
const TIGER_PITCH = pitchOf(TIGER_BLOCKS);
const QUILL_BODY = bodyOf(QUILL_BLOCKS);
const TIGER_BODY = bodyOf(TIGER_BLOCKS);

const FIT_MAX = 120;
const FIT_MIN = 9;
const fitStore = {
  sizes: new Map<number, number>(),
  heights: new Map<number, number>(),
  box: 0,
  listeners: new Set<() => void>(),
  notify() {
    this.listeners.forEach((l) => l());
  },
  set(id: number, size: number) {
    if (this.sizes.get(id) === size) return;
    this.sizes.set(id, size);
    this.notify();
  },
  setHeight(id: number, h: number, box: number) {
    if (this.heights.get(id) === h && this.box === box) return;
    this.heights.set(id, h);
    this.box = box;
    this.notify();
  },
  remove(id: number) {
    const changed = this.sizes.delete(id);
    if (this.heights.delete(id) || changed) this.notify();
  },
  min() {
    return this.sizes.size ? Math.min(...this.sizes.values()) : FIT_MAX;
  },
  topOffset() {
    if (!this.heights.size || !this.box) return 0;
    const maxH = Math.max(...this.heights.values());
    return Math.max(0, (this.box - maxH) / 2);
  },
  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  },
};
let _fitId = 0;

function Writing({ items, independent = false }: { items: Block[]; independent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(_fitId++);
  const sharedMin = useSyncExternalStore(
    (cb) => fitStore.subscribe(cb),
    () => fitStore.min(),
  );
  const topOffset = useSyncExternalStore(
    (cb) => fitStore.subscribe(cb),
    () => fitStore.topOffset(),
  );
  const [own, setOwn] = useState(FIT_MAX);
  const applied = independent ? own : sharedMin;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = idRef.current;
    const measure = () => {
      const content = contentRef.current;
      if (!content) return;
      let size = FIT_MAX;
      el.style.fontSize = size + "px";
      while (size > FIT_MIN && content.scrollHeight > el.clientHeight) {
        size -= 0.7;
        el.style.fontSize = size + "px";
      }
      if (independent) {
        setOwn(size);
        el.style.fontSize = size + "px";
      } else {
        fitStore.set(id, size);
        el.style.fontSize = fitStore.min() + "px";
      }
    };
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts?.load) {
      document.fonts.load("24px 'Reenie Beanie'").then(measure).catch(() => {});
    } else if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (!independent) fitStore.remove(id);
    };
  }, [items, independent]);
  useLayoutEffect(() => {
    if (independent) return;
    const el = ref.current;
    const content = contentRef.current;
    if (!el || !content) return;
    fitStore.setHeight(idRef.current, content.scrollHeight, el.clientHeight);
  }, [applied, items, independent]);
  return (
    <div
      className={`era-writing${independent ? " era-writing--center" : ""}`}
      ref={ref}
      style={{ fontSize: applied + "px" }}
    >
      <div
        className="era-writing-inner"
        ref={contentRef}
        style={independent ? undefined : { marginTop: topOffset + "px" }}
      >
        {items.map((b, i) => (
          <p key={i}>{b.text}</p>
        ))}
      </div>
    </div>
  );
}

function DevicePage({ src, alt, pitch }: { src: string; alt: string; pitch: string }) {
  return (
    <div className="era-devpage">
      <img className="era-devpage-img" src={src} alt={alt} />
      {pitch && <p className="era-devpage-pitch">{pitch}</p>}
    </div>
  );
}

const INTRO = <Writing items={INTRO_BLOCKS} independent />;
const QUILL_DEVICE = <DevicePage src={quillDeviceImg} alt="quill device sketch" pitch={QUILL_PITCH} />;
const QUILL_WRITING = <Writing items={QUILL_BODY} />;
const TIGER_DEVICE = <DevicePage src={tigerDeviceImg} alt="tiger device sketch" pitch={TIGER_PITCH} />;
const TIGER_WRITING = <Writing items={TIGER_BODY} />;

type Leaf = { front: ReactNode; back: ReactNode; frontClass: string; backClass: string };

const LEAVES: Leaf[] = [
  { front: COVER, back: null, frontClass: "era-cover", backClass: "era-inside-cover" },
  { front: INTRO, back: QUILL_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: QUILL_WRITING, back: TIGER_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: TIGER_WRITING, back: BACK_COVER, frontClass: "era-page", backClass: "era-cover" },
];

const MOBILE: { content: ReactNode; cover?: boolean }[] = [
  { content: COVER, cover: true },
  { content: INTRO },
  { content: QUILL_DEVICE },
  { content: QUILL_WRITING },
  { content: TIGER_DEVICE },
  { content: TIGER_WRITING },
  { content: BACK_COVER, cover: true },
];

function useIsMobile() {
  const query = "(max-width: 700px)";
  const [m, setM] = useState(
    () => window.matchMedia(query).matches,
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
  const p = parseInt(new URLSearchParams(window.location.search).get("p") || "", 10);
  return Number.isFinite(p) ? Math.max(0, Math.min(maxPage, p)) : 0;
}

export default function Era() {
  usePageTitle("era");
  const isMobile = useIsMobile();
  const total = isMobile ? MOBILE.length : LEAVES.length + 1;
  const max = total - 1;

  const [page, setPage] = useState(() => initialPage(LEAVES.length));
  const [turning, setTurning] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => { getHaptics(); ensureTurnAudio(); }, []);

  useEffect(() => { setPage((p) => Math.min(p, max)); }, [max]);

  useEffect(() => {
    if (turning !== null) {
      playPageTurn();
      playPageHaptic();
    }
  }, [turning]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
            const hidden = flipped && turning !== i;
            return (
              <div
                key={i}
                className={`era-mpage${flipped ? " is-flipped" : ""}`}
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
                <div className="era-face era-face--back era-mobile-back" {...tap(() => step(-1), "previous page")} />
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={`era-book${page === 0 ? " is-closed" : ""}${
            page === LEAVES.length ? " is-closed-back" : ""
          }${
            page > 0 && LEAVES[page - 1]?.backClass === "era-inside-cover" ? " is-cover-left" : ""
          }`}
        >
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
