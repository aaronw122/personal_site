import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./nutshell.css";

type NutshellProps = {
  def: string;
  children: ReactNode;
  renderMarkdown: (md: string) => ReactNode;
};

const GAP = 6;
const EDGE = 8;
// In insertion order, the last open card receives Escape first.
const openCards = new Set<HTMLElement>();
let nextLayer = 2000;

export default function Nutshell({ def, children, renderMarkdown }: NutshellProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [layer, setLayer] = useState(2000);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger || !card) return;
    openCards.add(card);

    let frame = 0;
    const position = () => {
      if (!trigger.isConnected) {
        card.style.visibility = "hidden";
        return;
      }
      if (expanded) {
        card.style.visibility = "visible";
        card.style.left = "";
        card.style.top = "";
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const parentCard = trigger.closest(".nutshell-popup");
      const clip = parentCard?.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight ||
        (clip && (rect.bottom <= clip.top || rect.top >= clip.bottom))) {
        card.style.visibility = "hidden";
        return;
      }
      card.style.visibility = "visible";
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      const left = Math.max(EDGE, Math.min((rect.left + rect.right - width) / 2, window.innerWidth - width - EDGE));
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      const top = below + height <= window.innerHeight - EDGE || above < EDGE ? below : above;
      card.style.left = `${left}px`;
      card.style.top = `${Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE))}px`;
    };
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
    };
    position();
    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(card);
    document.addEventListener("scroll", schedulePosition, true);
    window.addEventListener("resize", schedulePosition);

    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      // Portaled nested cards are outside their parent's DOM tree; keep all
      // ancestors open while interacting with any open card or term.
      if (target instanceof Element && target.closest(".nutshell-popup, .nutshell-trigger")) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      const cards = Array.from(openCards);
      if (event.key !== "Escape" || cards[cards.length - 1] !== card) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      openCards.delete(card);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, expanded]);

  // An expanded card acts as a modal: the page underneath must not scroll.
  useLayoutEffect(() => {
    if (!open || !expanded) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open, expanded]);

  const toggle = () => {
    if (!open) {
      setLayer(++nextLayer);
    } else {
      setExpanded(false);
    }
    setOpen(!open);
  };

  return <>
    <span
      ref={triggerRef}
      className={`nutshell-trigger${open ? " is-open" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }
      }}
    >{children}</span>
    {open && createPortal(
      <div ref={cardRef} className={`nutshell-popup${expanded ? " is-expanded" : ""}`} style={{ zIndex: layer }}>
        <div className="nutshell-toolbar">
          <button
            type="button"
            className="nutshell-expand"
            aria-label={expanded ? "Collapse definition" : "Expand definition"}
            title={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v5H3M16 21v-5h5M3 8l6-6M21 16l-6 6" /></svg>
              : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V3h6M21 15v6h-6M3 3l7 7M21 21l-7-7" /></svg>}
          </button>
        </div>
        <div className="nutshell-popup-content prose prose-full">{renderMarkdown(def)}</div>
      </div>, document.body,
    )}
  </>;
}
