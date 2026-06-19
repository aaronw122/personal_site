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

// Page-turn sound — plays the provided mp3 on each turn (clone allows overlap).
import turnSound from "../era-art/page-turn.mp3";
let _audio: HTMLAudioElement | null = null;
function playPageTurn() {
  try {
    if (!_audio) {
      _audio = new Audio(turnSound);
      _audio.preload = "auto";
    }
    const a = _audio.cloneNode(true) as HTMLAudioElement;
    a.volume = 0.7;
    void a.play().catch(() => {});
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

// shared page content, authored once
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

// fake barcode — a fixed bar-width pattern so it renders identically every time
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

// outside back cover — plain kraft like a LIFE Noble Note back: a crisp cloth
// binding strip at the spine edge and a dark barcode (printed straight onto the
// kraft) with the origin line beneath it.
const BACK_COVER: ReactNode = (
  <div className="era-backcover">
    <div className="era-spine era-spine--right" aria-hidden="true" />
    <div className="era-backcover-tag">
      <Barcode />
      <div className="era-backcover-made">made in brooklyn</div>
    </div>
  </div>
);
// split the .md into intro / quill / tiger writing. Markdown blockquotes (the
// "elevator pitch" lines) become emphasized callouts in the notebook.
type Block = { quote: boolean; text: string };
function blocks(section: string): Block[] {
  return section
    .replace(/!\[\[[^\]]+\]\]/g, "") // drop image embeds
    .split(/\n{2,}/) // blank line = block break
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

// the "elevator pitch" (the markdown blockquote) sits under the device sketch on
// the left page as plain text; the body paragraphs fill the right page.
const pitchOf = (bs: Block[]) => bs.find((b) => b.quote)?.text ?? "";
const bodyOf = (bs: Block[]) => bs.filter((b) => !b.quote);
const QUILL_PITCH = pitchOf(QUILL_BLOCKS);
const TIGER_PITCH = pitchOf(TIGER_BLOCKS);
const QUILL_BODY = bodyOf(QUILL_BLOCKS);
const TIGER_BODY = bodyOf(TIGER_BLOCKS);

// shared auto-fit: each writing page measures the largest font size at which it
// still fits, and EVERY page renders at the global minimum of those — so quill,
// tiger and intro read at one consistent size (the longest page sets the size,
// the shorter ones shrink to match) instead of each fitting independently.
const FIT_MAX = 120;
const FIT_MIN = 9;
const fitStore = {
  sizes: new Map<number, number>(),
  listeners: new Set<() => void>(),
  set(id: number, size: number) {
    if (this.sizes.get(id) === size) return;
    this.sizes.set(id, size);
    this.listeners.forEach((l) => l());
  },
  remove(id: number) {
    if (this.sizes.delete(id)) this.listeners.forEach((l) => l());
  },
  min() {
    return this.sizes.size ? Math.min(...this.sizes.values()) : FIT_MAX;
  },
  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  },
};
let _fitId = 0;

// renders the writing; the applied font size is the shared (consistent) fit
function Writing({ items, independent = false }: { items: Block[]; independent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(_fitId++);
  const sharedMin = useSyncExternalStore(
    (cb) => fitStore.subscribe(cb),
    () => fitStore.min(),
  );
  // independent pages (the shorter intro) fit their own page; shared pages
  // (quill/tiger) all render at the store min so they stay consistent
  const [own, setOwn] = useState(FIT_MAX);
  const applied = independent ? own : sharedMin;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = idRef.current;
    const measure = () => {
      // probe this page's own max-fit (largest size where content fits), then
      // report it; the rendered size is the shared store min
      let size = FIT_MAX;
      el.style.fontSize = size + "px";
      while (size > FIT_MIN && el.scrollHeight > el.clientHeight) {
        size -= 0.7;
        el.style.fontSize = size + "px";
      }
      if (independent) {
        // fill our own page; ignore the shared store entirely
        setOwn(size);
        el.style.fontSize = size + "px";
      } else {
        fitStore.set(id, size);
        // land on the shared min even if our value was unchanged (store.set may
        // skip a re-render) so every shared page stays one size
        el.style.fontSize = fitStore.min() + "px";
      }
    };
    measure();
    window.addEventListener("resize", measure);
    // re-measure once the handwriting font has actually loaded (metrics differ)
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => {
      window.removeEventListener("resize", measure);
      if (!independent) fitStore.remove(id);
    };
  }, [items, independent]);
  return (
    <div className="era-writing" ref={ref} style={{ fontSize: applied + "px" }}>
      {items.map((b, i) => (
        <p key={i}>{b.text}</p>
      ))}
    </div>
  );
}

// a device sketch with its elevator pitch as plain text underneath
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

// desktop: a bound book, two-page spreads
const LEAVES: Leaf[] = [
  { front: COVER, back: null, frontClass: "era-cover", backClass: "era-inside-cover" },
  { front: INTRO, back: QUILL_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: QUILL_WRITING, back: TIGER_DEVICE, frontClass: "era-page", backClass: "era-page" },
  { front: TIGER_WRITING, back: BACK_COVER, frontClass: "era-page", backClass: "era-cover" },
];

// mobile: one page at a time, in reading order
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
  // desktop has one extra state past the last spread: the closed back cover
  const total = isMobile ? MOBILE.length : LEAVES.length + 1;
  const max = total - 1;

  const [page, setPage] = useState(() => initialPage(LEAVES.length));
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

  // fullscreen toggle — maximizes the immersive view (great on mobile). Hidden
  // where the Fullscreen API isn't available (e.g. iPhone Safari); supports the
  // webkit-prefixed form for desktop/iPad Safari.
  const stageRef = useRef<HTMLDivElement>(null);
  const [fsSupported] = useState(() => {
    if (typeof document === "undefined") return false;
    const el = document.documentElement as any;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  });
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const doc = document as any;
    const onChange = () => setIsFs(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);
  const toggleFs = () => {
    const doc = document as any;
    const el = stageRef.current as any;
    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        (document.exitFullscreen || doc.webkitExitFullscreen).call(document);
      } else if (el) {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (p && p.catch) p.catch(() => {});
      }
    } catch {
      /* fullscreen denied — ignore */
    }
  };

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
    <div ref={stageRef} className={`era-stage${ready ? " is-ready" : ""}`}>
      <Link to="/" className="era-back">← awill.co</Link>
      {fsSupported && (
        <button
          className="era-fs"
          onClick={toggleFs}
          aria-label={isFs ? "exit fullscreen" : "enter fullscreen"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {isFs ? (
              <path d="M8 4v4H4 M16 4v4h4 M8 20v-4H4 M16 20v-4h4" />
            ) : (
              <path d="M4 8V4h4 M20 8V4h-4 M4 16v4h4 M20 16v4h-4" />
            )}
          </svg>
        </button>
      )}

      {isMobile ? (
        <div className="era-mobile" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {MOBILE.map((pg, i) => {
            const flipped = i < page;
            const z = turning === i ? 200 : flipped ? 100 + i : 100 + MOBILE.length - i;
            // once a page has finished turning, hide it so no "left page" /
            // spine line shows — mobile is strictly one page at a time
            const hidden = flipped && turning !== i;
            // mobile turns one page at a time: the turning page fades out as it
            // rotates (faster than the rotation) so it just "disappears" instead
            // of revealing its blank back / a desktop-style two-page spread.
            return (
              <div
                key={i}
                className="era-mpage"
                onTransitionEnd={endTurn(i)}
                style={{
                  zIndex: z,
                  transform: flipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                  opacity: flipped ? 0 : 1,
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
