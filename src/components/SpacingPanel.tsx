// TEMPORARY dev-only tuner for the --leading-* tokens in index.css :root.
// Drag a slider to preview live, "copy css" the result into :root, then delete
// this file and its mount in App.tsx.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const TOKENS = [
  { name: "--leading-body", label: "body / ui", min: 1, max: 2.2 },
  { name: "--leading-prose", label: "prose", min: 1, max: 2.2 },
  { name: "--leading-heading", label: "headings", min: 0.8, max: 1.8 },
] as const;

const STEP = 0.025;
const STORAGE_KEY = "spacing-panel";
const root = document.documentElement;

// Stylesheet values, read with inline overrides cleared so an HMR re-run of
// this module doesn't mistake a previous override for the default.
for (const t of TOKENS) root.style.removeProperty(t.name);
const DEFAULTS = TOKENS.map((t) =>
  parseFloat(getComputedStyle(root).getPropertyValue(t.name)),
);

function loadSaved(): number[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      Array.isArray(saved) &&
      saved.length === TOKENS.length &&
      saved.every(Number.isFinite)
    ) {
      return saved.map(Number);
    }
  } catch {
    // corrupt entry — fall through to defaults
  }
  return DEFAULTS;
}

const fmt = (n: number) => String(Number(n.toFixed(3)));

export default function SpacingPanel() {
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState(loadSaved);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    TOKENS.forEach((t, i) => {
      if (values[i] === DEFAULTS[i]) root.style.removeProperty(t.name);
      else root.style.setProperty(t.name, fmt(values[i]));
    });
    // Persist only real overrides, so untouched defaults never mask a later
    // hand edit to :root.
    if (values.every((v, i) => v === DEFAULTS[i])) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, [values]);

  function copyCss() {
    const css = TOKENS.map((t, i) => `  ${t.name}: ${fmt(values[i])};`).join("\n");
    navigator.clipboard.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!open) {
    return (
      <button style={{ ...panel, padding: "6px 10px" }} onClick={() => setOpen(true)}>
        spacing
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>line spacing</strong>
        <button style={link} onClick={() => setOpen(false)} aria-label="Collapse">
          ×
        </button>
      </div>
      {TOKENS.map((t, i) => (
        <label key={t.name} style={{ display: "block", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{t.label}</span>
            <span style={{ opacity: values[i] === DEFAULTS[i] ? 0.5 : 1 }}>
              {fmt(values[i])}
            </span>
          </div>
          <input
            type="range"
            min={t.min}
            max={t.max}
            step={STEP}
            value={values[i]}
            onChange={(e) => {
              const next = [...values];
              next[i] = Number(e.target.value);
              setValues(next);
            }}
            style={{ width: "100%" }}
          />
        </label>
      ))}
      <div style={{ display: "flex", gap: 12 }}>
        <button style={link} onClick={copyCss}>
          {copied ? "copied" : "copy css"}
        </button>
        <button style={link} onClick={() => setValues(DEFAULTS)}>
          reset
        </button>
      </div>
    </div>
  );
}

// Fixed type metrics so the panel itself doesn't reflow while you tune.
const panel: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 1000,
  width: 220,
  padding: 12,
  font: "12px/1.4 var(--font-primary), sans-serif",
  color: "var(--color-fg-1)",
  background: "var(--color-paper)",
  border: "1px solid rgba(0, 0, 0, 0.15)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
};

const link: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  color: "inherit",
};
