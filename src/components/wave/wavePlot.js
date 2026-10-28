// @ts-nocheck
// Adapted from the Obsidian wave-plot plugin; rendering and parsing are unchanged.
class MarkdownRenderChild {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }
}

/*
 * ```wave
 * title: Two cosines
 * t: -T, T                       # x range (ns); may use sliders
 * y: -2.2, 2.2                   # optional fixed y range (default: auto)
 * samples: 4000                  # optional
 * slider f1: 8.0, 7, 9, 0.01     # value, min, max, step
 * let gap: abs(f2 - f1)          # constant/function built from sliders (no t)
 * plot sum: cos(2*pi*f1*t) + cos(2*pi*f2*t)
 * plot envelope, dashed: 2*abs(cos(pi*gap*t))
 * plot fit, green: exp(-t*t)      # color flag: blue, orange, green, red, purple, brown (default: next in order)
 * readout gap (GHz): gap
 * formula: y(t) = cos(2π · {f1} · t)   # text under the plot; {expr} filled live from sliders
 * mark repeats here: 1/gap          # dashed vertical line at this t
 * formula if f2 > f1: f2 is faster     # only shown while the condition is true (no ":" in it)
 * play f1: 10                      # play button: runs slider f1 from min to max over 10 s
 * family tones: N, a(i)*cos(2*pi*f(i)*t)   # N curves, i = 0..N-1, rainbow colors (red = first, violet = last)
 * stems tones: N, f(i), a(i)     # N vertical lines at x = f(i) with height a(i), same colors as a family of N (or "stems tones, blue:" for one color)
 *                                 # families and stems draw under the plot lines; plot colors skip them
 * arrow hyp, red: 0, 0, cx, sy    # arrow from (x0, y0) to (x1, y1) in plot coordinates; flags: color, dashed, line (no head)
 * plot circle, dashed, nolegend: sqrt(1 - t*t)   # nolegend: leave this plot out of the legend
 * aspect: equal                   # this panel draws 1 unit of x as long as 1 unit of y (narrows the canvas to fit)
 *
 * Several stacked plots sharing the same sliders: start each with "panel: title".
 * y / plot / mark / formula lines after a panel line belong to that panel.
 * A "t:" line after a panel line gives that panel its own x range; "xlabel:" sets a panel's x axis label.
 * height: 200                    # optional canvas height (px); before any panel = every panel, after a panel line = that panel only
 * sliders: here                  # optional: put the sliders at this point, e.g. between two panels (default: top when stacked)
 * panel: 1. first stage
 * plot a: cos(2*pi*f1*t)
 * panel: 2. second stage
 * plot b: cos(2*pi*f1*t)**2
 * panel: 3. spectrum
 * t: -1000, 1000                 # this panel only; t is still the variable name in its expressions
 * xlabel: offset from carrier (MHz)
 * plot c: exp(-(t/300)**2)
 * ```
 */

const HELPERS = {
  pi: Math.PI,
  cos: Math.cos,
  sin: Math.sin,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  round: Math.round,
  sign: Math.sign,
  // sum(n, i => term) = term(0) + ... + term(n-1)
  sum: (n, term) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += term(i);
    return s;
  },
  // Gaussian bump at 0 with standard deviation sigma, peak 1
  gauss: (x, sigma) => Math.exp(-(x * x) / (2 * sigma * sigma)),
};
const HELPER_NAMES = Object.keys(HELPERS);
const HELPER_VALUES = Object.values(HELPERS);

const PALETTE = ["#4e9af1", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#9c755f"];
const COLOR_NAMES = ["blue", "orange", "green", "red", "purple", "brown"];
const plotColor = (q, i) => PALETTE[q.color >= 0 ? q.color : i % PALETTE.length];
const MAX_FAMILY = 400;
// Color of item i out of count, red (first) to violet (last), so a family and stems with the same count match.
const rainbow = (i, count) => `hsl(${count > 1 ? (270 * i) / (count - 1) : 0}, 80%, 58%)`;
const RAINBOW_SWATCH = "linear-gradient(90deg, hsl(0,80%,58%), hsl(60,80%,58%), hsl(120,80%,58%), hsl(200,80%,58%), hsl(270,80%,58%)) 1";
const HEIGHT = 280;
const PAD = { left: 48, right: 12, top: 10, bottom: 28 };
const IDENT = /^[A-Za-z_]\w*$/;

// Split on commas that are not inside parentheses.
function splitTop(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function newPanel(title) {
  return { title, t: null, xlabel: null, y: null, equal: false, plots: [], families: [], stems: [], arrows: [], marks: [], formulas: [] };
}

function parseSpec(source) {
  const spec = { title: null, t: ["-5", "5"], samples: 4000, height: null, slidersAt: null, sliders: [], lets: [], readouts: [], plays: [], panels: [] };
  // y, plot, mark and formula lines belong to the latest "panel:" line (an untitled panel if there is none).
  const panel = () => {
    if (!spec.panels.length) spec.panels.push(newPanel(null));
    return spec.panels[spec.panels.length - 1];
  };
  let explicitPanel = false;
  source.split("\n").forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const fail = (msg) => {
      throw new Error(`line ${n + 1}: ${msg}`);
    };
    const colon = line.indexOf(":");
    if (colon < 0) fail('expected "key: value"');
    const [kind, ...rest] = line.slice(0, colon).trim().split(/\s+/);
    const name = rest.join(" ");
    const value = line.slice(colon + 1).trim();
    const list = (count) => {
      const parts = splitTop(value);
      if (parts.length !== count) fail(`expected ${count} comma-separated values`);
      return parts;
    };
    switch (kind) {
      case "title":
        spec.title = value;
        break;
      case "sliders":
        if (value !== "here") fail('expected "sliders: here"');
        spec.slidersAt = spec.panels.length;
        break;
      case "t":
        if (explicitPanel) panel().t = list(2);
        else spec.t = list(2);
        break;
      case "xlabel":
        panel().xlabel = value;
        break;
      case "samples":
        spec.samples = Number(value);
        if (!(spec.samples >= 2)) fail("samples must be a number >= 2");
        break;
      case "height": {
        const h = Number(value);
        if (!(h >= 60)) fail("height must be a number >= 60");
        if (explicitPanel) panel().height = h;
        else spec.height = h;
        break;
      }
      case "slider": {
        if (!IDENT.test(name)) fail(`bad slider name "${name}"`);
        const [v, lo, hi, step] = list(4).map(Number);
        if ([v, lo, hi, step].some(Number.isNaN)) fail("slider values must be numbers");
        spec.sliders.push({ name, value: v, min: lo, max: hi, step });
        break;
      }
      case "let":
        if (!IDENT.test(name)) fail(`bad let name "${name}"`);
        spec.lets.push({ name, expr: value });
        break;
      case "readout":
        spec.readouts.push({ label: name || value, expr: value });
        break;
      case "panel":
        spec.panels.push(newPanel(value || null));
        explicitPanel = true;
        break;
      case "y":
        panel().y = list(2);
        break;
      case "plot": {
        const [label, ...flags] = name.split(",").map((s) => s.trim());
        panel().plots.push({
          label: label || value,
          expr: value,
          dashed: flags.includes("dashed"),
          nolegend: flags.includes("nolegend"),
          color: COLOR_NAMES.findIndex((c) => flags.includes(c)),
        });
        break;
      }
      case "arrow": {
        const [label, ...flags] = name.split(",").map((s) => s.trim());
        panel().arrows.push({
          label: label || value,
          coords: list(4),
          dashed: flags.includes("dashed"),
          head: !flags.includes("line"),
          color: COLOR_NAMES.findIndex((c) => flags.includes(c)),
        });
        break;
      }
      case "aspect":
        if (value !== "equal") fail('expected "aspect: equal"');
        panel().equal = true;
        break;
      case "family": {
        const [count, expr] = list(2);
        panel().families.push({ label: name || "family", count, expr });
        break;
      }
      case "stems": {
        const [count, x, y] = list(3);
        const [label, ...flags] = name.split(",").map((s) => s.trim());
        panel().stems.push({ label: label || "stems", count, x, y, color: COLOR_NAMES.findIndex((c) => flags.includes(c)) });
        break;
      }
      case "mark":
        panel().marks.push({ label: name || value, expr: value });
        break;
      case "formula":
        if (name && !name.startsWith("if ")) fail('write "formula: text" or "formula if CONDITION: text"');
        panel().formulas.push({ cond: name ? name.slice(3).trim() : null, text: value });
        break;
      case "play": {
        const seconds = Number(value);
        if (!IDENT.test(name)) fail(`bad play slider name "${name}"`);
        if (!(seconds > 0)) fail("play needs the number of seconds, e.g. play step: 12");
        spec.plays.push({ name, seconds });
        break;
      }
      default:
        fail(`unknown key "${kind}"`);
    }
  });
  if (!spec.panels.length || spec.panels.some((p) => !p.plots.length && !p.families.length && !p.stems.length && !p.arrows.length)) {
    throw new Error('add at least one "plot", "family", "stems" or "arrow" line (to every panel)');
  }
  const missing = spec.plays.find((p) => !spec.sliders.some((s) => s.name === p.name));
  if (missing) throw new Error(`play: no slider named "${missing.name}"`);
  return spec;
}

// Returns (sliderValues) => ((...params) => expr). Lets are evaluated once per render, before t.
function compile(expr, spec, params = "t") {
  const lets = spec.lets.map((l) => `const ${l.name} = (${l.expr});`).join("\n");
  const make = new Function(
    ...HELPER_NAMES,
    ...spec.sliders.map((s) => s.name),
    `"use strict";\n${lets}\nreturn (${params}) => (${expr});`,
  );
  return (values) => make(...HELPER_VALUES, ...values);
}

function niceStep(span, target) {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
}

function ticks(lo, hi, target) {
  const step = niceStep(hi - lo, target);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push({ v, label: Number(v.toFixed(decimals)).toString() });
  }
  return out;
}

function formatValue(v) {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "—";
  if (Math.abs(v) < 1e-9) return "0"; // floating-point residue from cancelling sums
  return Number(v.toPrecision(4)).toString();
}

class WavePlot extends MarkdownRenderChild {
  constructor(containerEl, spec) {
    super(containerEl);
    this.spec = spec;
    this.values = spec.sliders.map((s) => s.value);
    this.frame = 0;
  }

  onload() {
    const { spec } = this;
    const root = this.containerEl;
    root.classList.add("wave-plot");

    if (spec.title) root.appendChild(el("div", "wave-plot-title", spec.title));

    // With stacked panels the sliders go on top, above the first panel (they scroll with the plot).
    const stacked = spec.panels.length > 1;
    this.height = spec.height || (stacked ? 200 : HEIGHT);

    this.panelEls = spec.panels.map((p) => {
      const box = el("div", "wave-plot-panel");
      if (p.title) box.appendChild(el("div", "wave-plot-panel-title", p.title));
      const canvas = el("canvas", "wave-plot-canvas");
      canvas.style.height = `${p.height || this.height}px`;
      const legend = el("div", "wave-plot-legend");
      const addItem = (label, style, dashed) => {
        const item = el("span", "wave-plot-legend-item");
        const swatch = el("span", `wave-plot-swatch${dashed ? " is-dashed" : ""}`);
        Object.assign(swatch.style, style);
        item.append(swatch, document.createTextNode(label));
        legend.appendChild(item);
      };
      p.families.forEach((q) => addItem(q.label, { borderImage: RAINBOW_SWATCH }, false));
      p.stems.forEach((q) => addItem(q.label, q.color >= 0 ? { borderColor: PALETTE[q.color] } : { borderImage: RAINBOW_SWATCH }, false));
      p.plots.forEach((q, i) => q.nolegend || addItem(q.label, { borderColor: plotColor(q, i) }, q.dashed));
      p.arrows.forEach((q, i) => addItem(q.label, { borderColor: plotColor(q, p.plots.length + i) }, q.dashed));
      const formulas = p.formulas.map(() => el("div", "wave-plot-formula"));
      box.append(canvas, legend, ...formulas);
      return { box, canvas, formulas };
    });

    this.error = el("div", "wave-plot-error");
    const placed = spec.slidersAt !== null;
    const sliders = el("div", `wave-plot-sliders${stacked && !placed ? " is-top" : ""}`);
    const handles = spec.sliders.map((s, i) =>
      makeSlider(sliders, s, (v) => {
        this.values[i] = v;
        this.schedule();
      }),
    );
    this.stopPlays = spec.plays.map((p) => this.addPlayButton(sliders, p, handles));
    this.readoutEls = spec.readouts.map(() => el("div", "wave-plot-readout"));

    const boxes = this.panelEls.map((p) => p.box);
    if (placed) root.append(...boxes.slice(0, spec.slidersAt), this.error, sliders, ...boxes.slice(spec.slidersAt), ...this.readoutEls);
    else if (stacked) root.append(sliders, this.error, ...boxes, ...this.readoutEls);
    else root.append(...boxes, this.error, sliders, ...this.readoutEls);

    try {
      this.range = spec.t.map((e) => compile(e, spec));
      this.readouts = spec.readouts.map((r) => compile(r.expr, spec));
      this.panels = spec.panels.map((p) => ({
        plots: p.plots.map((q) => compile(q.expr, spec)),
        families: p.families.map((q) => ({ count: compile(q.count, spec), curve: compile(q.expr, spec, "i, t") })),
        stems: p.stems.map((q) => ({ count: compile(q.count, spec), x: compile(q.x, spec, "i"), y: compile(q.y, spec, "i"), color: q.color })),
        arrows: p.arrows.map((q) => q.coords.map((e) => compile(e, spec))),
        t: p.t && p.t.map((e) => compile(e, spec)),
        y: p.y && p.y.map((e) => compile(e, spec)),
        marks: p.marks.map((m) => compile(m.expr, spec)),
        // Literal text alternates with compiled {expression} parts: [text, fn, text, fn, ..., text].
        formulas: p.formulas.map((f) => ({
          cond: f.cond && compile(f.cond, spec),
          parts: f.text.split(/\{([^{}]+)\}/).map((part, i) => (i % 2 ? compile(part, spec) : part)),
        })),
      }));
    } catch (e) {
      this.error.textContent = `wave: ${e.message}`;
      return;
    }

    this.resizer = new ResizeObserver(() => this.schedule());
    this.panelEls.forEach((p) => this.resizer.observe(p.box));
    this.schedule();
  }

  onunload() {
    if (this.resizer) this.resizer.disconnect();
    cancelAnimationFrame(this.frame);
    (this.stopPlays || []).forEach((stop) => stop());
  }

  // Button that runs one slider from its min to its max over `seconds`, then stops. Returns a stop function.
  addPlayButton(parent, play, handles) {
    const i = this.spec.sliders.findIndex((s) => s.name === play.name);
    const s = this.spec.sliders[i];
    const idle = `▶ play ${play.name}`;
    const button = el("button", "wave-plot-play", idle);
    let frame = 0;
    let last = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      button.textContent = idle;
    };
    const tick = (now) => {
      const v = Math.min(s.max, this.values[i] + ((s.max - s.min) * (now - last)) / 1000 / play.seconds);
      last = now;
      this.values[i] = v;
      handles[i].set(Number(v.toFixed(4)));
      this.schedule();
      if (v >= s.max) stop();
      else frame = requestAnimationFrame(tick);
    };
    button.addEventListener("click", () => {
      if (frame) return stop();
      if (this.values[i] >= s.max) this.values[i] = s.min;
      button.textContent = `⏸ pause ${play.name}`;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    });
    parent.appendChild(button);
    return stop;
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      try {
        this.error.textContent = "";
        this.draw();
      } catch (e) {
        this.error.textContent = `wave: ${e.message}`;
      }
    });
  }

  draw() {
    const { spec, values } = this;
    this.readoutEls.forEach((r, i) => {
      r.textContent = `${spec.readouts[i].label} = ${formatValue(this.readouts[i](values)(0))}`;
    });

    const [t0, t1] = this.range.map((f) => f(values)(0));
    spec.panels.forEach((p, i) => {
      const compiled = this.panels[i];
      const [a, b] = compiled.t ? compiled.t.map((f) => f(values)(0)) : [t0, t1];
      if (!(b > a)) throw new Error(`t range is empty (${formatValue(a)} to ${formatValue(b)})`);
      this.drawPanel(p, compiled, this.panelEls[i], a, b);
    });
  }

  drawPanel(panel, compiled, els, t0, t1) {
    const { spec, values } = this;
    els.formulas.forEach((node, i) => {
      const f = compiled.formulas[i];
      const shown = !f.cond || Boolean(f.cond(values)(0));
      node.style.display = shown ? "" : "none";
      if (shown) node.textContent = f.parts.map((part, j) => (j % 2 ? formatValue(part(values)(0)) : part)).join("");
    });

    const { canvas } = els;
    const n = Math.floor(spec.samples);
    const sample = (f) => {
      const ys = new Float64Array(n);
      for (let k = 0; k < n; k++) ys[k] = f(t0 + ((t1 - t0) * k) / (n - 1));
      return ys;
    };
    const countOf = (make) => Math.max(0, Math.min(MAX_FAMILY, Math.floor(make(values)(0))));
    const series = compiled.plots.map((make) => sample(make(values)));
    // Rainbow curves: every member i of every family, colored by its position in that family.
    const members = compiled.families.flatMap((fam) => {
      const curve = fam.curve(values);
      const count = countOf(fam.count);
      return Array.from({ length: count }, (_, i) => ({ ys: sample((t) => curve(i, t)), color: rainbow(i, count) }));
    });
    const stems = compiled.stems.flatMap((s) => {
      const [x, y] = [s.x(values), s.y(values)];
      const count = countOf(s.count);
      return Array.from({ length: count }, (_, i) => ({ x: x(i), y: y(i), color: s.color >= 0 ? PALETTE[s.color] : rainbow(i, count) }));
    });
    const arrows = compiled.arrows.map((coords) => coords.map((f) => f(values)(0)));

    let y0, y1;
    if (compiled.y) {
      [y0, y1] = compiled.y.map((f) => f(values)(0));
    } else {
      y0 = Infinity;
      y1 = -Infinity;
      const grow = (y) => Number.isFinite(y) && ((y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)));
      for (const ys of series) ys.forEach(grow);
      for (const m of members) m.ys.forEach(grow);
      for (const s of stems) if (s.x >= t0 && s.x <= t1) grow(s.y), grow(0);
      for (const [, ay0, , ay1] of arrows) grow(ay0), grow(ay1);
      if (!Number.isFinite(y0)) (y0 = -1), (y1 = 1);
      const pad = (y1 - y0) * 0.05 || 1;
      y0 -= pad;
      y1 += pad;
    }

    // Size the canvas now that the y range is known: an equal-aspect panel narrows its width to match its height.
    const H = panel.height || this.height;
    let width = canvas.parentElement.clientWidth;
    if (!width) return;
    if (panel.equal) {
      const plotHeight = H - PAD.top - PAD.bottom;
      width = Math.min(width, Math.round((plotHeight * (t1 - t0)) / (y1 - y0)) + PAD.left + PAD.right);
      canvas.style.width = `${width}px`;
    }
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, H);

    const css = getComputedStyle(this.containerEl);
    const muted = css.getPropertyValue("--text-muted").trim() || "#888";
    const grid = css.getPropertyValue("--background-modifier-border").trim() || "#ddd";
    const plotW = width - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const sx = (t) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
    const sy = (y) => PAD.top + (1 - (y - y0) / (y1 - y0)) * plotH;

    g.font = `11px ${css.getPropertyValue("--font-interface").trim() || "sans-serif"}`;
    g.lineWidth = 1;
    g.strokeStyle = grid;
    g.fillStyle = muted;
    g.textAlign = "center";
    g.textBaseline = "top";
    for (const { v, label } of ticks(t0, t1, Math.max(2, Math.floor(plotW / 80)))) {
      g.beginPath();
      g.moveTo(sx(v), PAD.top);
      g.lineTo(sx(v), PAD.top + plotH);
      g.stroke();
      g.fillText(label, sx(v), PAD.top + plotH + 4);
    }
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (const { v, label } of ticks(y0, y1, 5)) {
      g.beginPath();
      g.moveTo(PAD.left, sy(v));
      g.lineTo(PAD.left + plotW, sy(v));
      g.stroke();
      g.fillText(label, PAD.left - 6, sy(v));
    }
    g.textAlign = "right";
    g.textBaseline = "bottom";
    g.fillText(panel.xlabel || "t (ns)", PAD.left + plotW, H - 1);

    g.save();
    g.beginPath();
    g.rect(PAD.left, PAD.top, plotW, plotH);
    g.clip();
    const strokeSeries = (ys) => {
      g.beginPath();
      let pen = false;
      for (let k = 0; k < n; k++) {
        if (!Number.isFinite(ys[k])) {
          pen = false;
          continue;
        }
        const x = PAD.left + (k / (n - 1)) * plotW;
        if (pen) g.lineTo(x, sy(ys[k]));
        else g.moveTo(x, sy(ys[k]));
        pen = true;
      }
      g.stroke();
    };
    g.lineWidth = 1;
    g.globalAlpha = 0.75;
    for (const m of members) {
      g.strokeStyle = m.color;
      strokeSeries(m.ys);
    }
    g.globalAlpha = 1;
    g.lineWidth = 2;
    for (const s of stems) {
      if (!(s.x >= t0 && s.x <= t1) || !Number.isFinite(s.y)) continue;
      g.strokeStyle = g.fillStyle = s.color;
      g.beginPath();
      g.moveTo(sx(s.x), sy(0));
      g.lineTo(sx(s.x), sy(s.y));
      g.stroke();
      g.beginPath();
      g.arc(sx(s.x), sy(s.y), 3, 0, 2 * Math.PI);
      g.fill();
    }
    g.lineWidth = 1.5;
    series.forEach((ys, i) => {
      g.strokeStyle = plotColor(panel.plots[i], i);
      g.setLineDash(panel.plots[i].dashed ? [6, 4] : []);
      strokeSeries(ys);
    });
    g.lineWidth = 2.5;
    arrows.forEach(([ax0, ay0, ax1, ay1], i) => {
      const q = panel.arrows[i];
      if (![ax0, ay0, ax1, ay1].every(Number.isFinite)) return;
      const color = plotColor(q, panel.plots.length + i);
      const [px0, py0, px1, py1] = [sx(ax0), sy(ay0), sx(ax1), sy(ay1)];
      g.strokeStyle = g.fillStyle = color;
      g.setLineDash(q.dashed ? [6, 4] : []);
      g.beginPath();
      g.moveTo(px0, py0);
      g.lineTo(px1, py1);
      g.stroke();
      const len = Math.hypot(px1 - px0, py1 - py0);
      if (!q.head || len < 4) return;
      const angle = Math.atan2(py1 - py0, px1 - px0);
      const size = Math.min(12, len / 2);
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(px1, py1);
      g.lineTo(px1 - size * Math.cos(angle - 0.4), py1 - size * Math.sin(angle - 0.4));
      g.lineTo(px1 - size * Math.cos(angle + 0.4), py1 - size * Math.sin(angle + 0.4));
      g.closePath();
      g.fill();
    });
    g.setLineDash([]);
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.strokeStyle = muted;
    g.fillStyle = muted;
    g.textBaseline = "top";
    compiled.marks.forEach((make, i) => {
      const x = make(values)(0);
      if (!(x >= t0 && x <= t1)) return;
      const px = sx(x);
      const right = px > PAD.left + plotW * 0.75;
      g.beginPath();
      g.moveTo(px, PAD.top);
      g.lineTo(px, PAD.top + plotH);
      g.stroke();
      g.textAlign = right ? "right" : "left";
      g.fillText(panel.marks[i].label, px + (right ? -3 : 3), PAD.top + 2 + 13 * i);
    });
    g.restore();
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// Range + number input pair kept in sync. Returns setters for programmatic updates.
function makeSlider(parent, s, onChange, cls = "") {
  const row = el("div", `wave-plot-slider ${cls}`.trim());
  const range = el("input");
  const num = el("input");
  range.type = "range";
  num.type = "number";
  for (const input of [range, num]) {
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(s.value);
  }
  const onInput = (source, other) => () => {
    const v = Number(source.value);
    if (Number.isNaN(v)) return;
    other.value = source.value;
    onChange(v);
  };
  range.addEventListener("input", onInput(range, num));
  num.addEventListener("input", onInput(num, range));
  row.append(el("label", "wave-plot-slider-name", s.label || s.name), range, num);
  parent.appendChild(row);
  return {
    set(v) {
      range.value = num.value = String(v);
    },
    setMax(m) {
      range.max = num.max = String(m);
    },
  };
}

/*
 * ```pulse
 * a: 100          # bandwidth of top pulse (MHz)
 * b: 500          # bandwidth of bottom pulse (MHz)
 * distance: 5     # TX to RX (m)
 * step: 0.1       # simulated ns added per tick
 * tick: 0.1       # real seconds between ticks
 * carrier: 8      # GHz
 * ```
 * Every line is optional; each value is also a slider.
 */
const C = 0.299792458; // metres per ns
const PULSE_DEFAULTS = { a: 100, b: 500, distance: 5, step: 0.1, tick: 0.1, carrier: 8 };
const CLOCK_H = 30;
const LANE_H = 130;
const AXIS_H = 40;
const PULSE_H = CLOCK_H + LANE_H * 2 + AXIS_H;

// Parser for blocks made only of optional "key: number" lines with known defaults.
const parseKeys = (defaults) => (source) => {
  const cfg = { ...defaults };
  source.split("\n").forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = line.match(/^(\w+)\s*:\s*([^#]+)/);
    if (!m || !(m[1] in defaults) || Number.isNaN(Number(m[2]))) {
      throw new Error(`line ${n + 1}: expected "<${Object.keys(defaults).join("|")}>: number"`);
    }
    cfg[m[1]] = Number(m[2]);
  });
  return cfg;
};

const fmt = (v) => Number(v.toFixed(2)).toString();
const fmtLength = (m) => (m >= 1 ? `${m.toFixed(2)} m` : `${Math.round(m * 100)} cm`);

// Pulses leave TX (x = 0) at t = 0 and move right at c. Drawn in space, not time.
class PulseSim extends MarkdownRenderChild {
  constructor(containerEl, cfg) {
    super(containerEl);
    this.cfg = cfg;
    this.time = 0;
    this.playing = false;
    this.frame = 0;
    this.timer = 0;
  }

  lanes() {
    return [
      { bw: this.cfg.a, color: PALETTE[1] },
      { bw: this.cfg.b, color: PALETTE[0] },
    ].map((l) => ({ ...l, dur: 1000 / l.bw }));
  }

  endTime() {
    return this.cfg.distance / C + Math.max(...this.lanes().map((l) => l.dur)) + 1;
  }

  onload() {
    const root = this.containerEl;
    root.classList.add("wave-plot");
    root.appendChild(el("div", "wave-plot-title", "Pulses leaving TX, travelling at light speed, passing RX"));

    this.canvas = el("canvas", "wave-plot-canvas");
    this.canvas.style.height = `${PULSE_H}px`;
    root.appendChild(this.canvas);

    const controls = el("div", "wave-plot-controls");
    this.playBtn = el("button", null, "▶ Play");
    this.playBtn.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
    const reset = el("button", null, "Reset");
    reset.addEventListener("click", () => {
      this.pause();
      this.setTime(0);
    });
    controls.append(this.playBtn, reset);
    root.appendChild(controls);

    this.timeSlider = makeSlider(
      root,
      { label: "time (ns)", value: 0, min: 0, max: fmt(this.endTime()), step: 0.01 },
      (v) => {
        this.pause();
        this.setTime(v);
      },
      "is-wide",
    );
    const knob = (key, label, min, max, step, after) =>
      makeSlider(
        root,
        { label, value: this.cfg[key], min, max, step },
        (v) => {
          if (v <= 0) return;
          this.cfg[key] = v;
          this.timeSlider.setMax(fmt(this.endTime()));
          if (after) after();
          this.schedule();
        },
        "is-wide",
      );
    const restart = () => this.playing && this.play();
    knob("a", "top pulse (MHz)", 20, 1000, 10);
    knob("b", "bottom pulse (MHz)", 20, 1000, 10);
    knob("distance", "TX to RX (m)", 1, 20, 0.5);
    knob("step", "ns per tick", 0.01, 2, 0.01);
    knob("tick", "seconds per tick", 0.01, 1, 0.01, restart);
    knob("carrier", "carrier (GHz)", 0.5, 10, 0.1);

    this.resizer = new ResizeObserver(() => this.schedule());
    this.resizer.observe(this.canvas);
    this.schedule();
  }

  onunload() {
    this.resizer.disconnect();
    cancelAnimationFrame(this.frame);
    clearInterval(this.timer);
  }

  play() {
    if (this.time >= this.endTime()) this.setTime(0);
    clearInterval(this.timer);
    this.playing = true;
    this.playBtn.textContent = "❚❚ Pause";
    this.timer = setInterval(() => {
      const end = this.endTime();
      this.setTime(Math.min(end, this.time + this.cfg.step));
      if (this.time >= end) this.pause();
    }, this.cfg.tick * 1000);
  }

  pause() {
    clearInterval(this.timer);
    this.playing = false;
    this.playBtn.textContent = "▶ Play";
  }

  setTime(v) {
    this.time = v;
    this.timeSlider.set(fmt(v));
    this.schedule();
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  draw() {
    const { canvas, cfg, time } = this;
    const width = canvas.clientWidth;
    if (!width) return;
    const height = PULSE_H;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    const css = getComputedStyle(this.containerEl);
    const text = css.getPropertyValue("--text-normal").trim() || "#ddd";
    const muted = css.getPropertyValue("--text-muted").trim() || "#888";
    const grid = css.getPropertyValue("--background-modifier-border").trim() || "#444";
    g.font = `11px ${css.getPropertyValue("--font-interface").trim() || "sans-serif"}`;

    const d = cfg.distance;
    const x0 = -0.06 * d - 0.2;
    const x1 = d * 1.3 + 0.2;
    const plotW = width - PAD.left - PAD.right;
    const sx = (x) => PAD.left + ((x - x0) / (x1 - x0)) * plotW;
    const lanes = this.lanes();
    lanes.forEach((lane, i) => {
      const top = CLOCK_H + i * LANE_H;
      const mid = top + LANE_H * 0.6;
      const amp = LANE_H * 0.3;
      const env = (u) => (u >= 0 && u <= lane.dur ? Math.sin((Math.PI * u) / lane.dur) ** 2 : 0);

      g.fillStyle = lane.color;
      g.textAlign = "left";
      g.textBaseline = "top";
      g.fillText(`${fmt(lane.bw)} MHz`, 4, top + 4);

      // TX antenna and RX line
      g.strokeStyle = muted;
      g.lineWidth = 1;
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(PAD.left, mid);
      g.lineTo(PAD.left + plotW, mid);
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = text;
      g.beginPath();
      g.moveTo(sx(0), mid - amp - 6);
      g.lineTo(sx(0), mid + amp + 6);
      g.stroke();
      g.setLineDash([5, 4]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(sx(d), mid - amp - 6);
      g.lineTo(sx(d), mid + amp + 6);
      g.stroke();
      g.setLineDash([]);
      // carrier (thin) and envelope (bold), sampled twice per pixel
      const n = Math.ceil(plotW * 2);
      const xs = (k) => x0 + (k / n) * (x1 - x0);
      g.save();
      g.beginPath();
      g.rect(sx(0), top, sx(x1) - sx(0), LANE_H);
      g.clip();
      g.strokeStyle = lane.color;
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      g.beginPath();
      for (let k = 0; k <= n; k++) {
        const u = time - xs(k) / C;
        const y = mid - amp * env(u) * Math.cos(2 * Math.PI * cfg.carrier * u);
        k ? g.lineTo(sx(xs(k)), y) : g.moveTo(sx(xs(k)), y);
      }
      g.stroke();
      g.globalAlpha = 1;
      g.lineWidth = 2;
      for (const sign of [1, -1]) {
        g.beginPath();
        for (let k = 0; k <= n; k++) {
          const y = mid - sign * amp * env(time - xs(k) / C);
          k ? g.lineTo(sx(xs(k)), y) : g.moveTo(sx(xs(k)), y);
        }
        g.stroke();
      }
      g.restore();

      // length bracket from back to front of the pulse
      const front = C * time;
      const back = Math.max(0, C * (time - lane.dur));
      if (time > 0 && back < x1) {
        const y = mid - amp - 14;
        const a = sx(back);
        const b = sx(Math.min(front, x1));
        g.strokeStyle = lane.color;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(a, y - 4);
        g.lineTo(a, y + 4);
        g.moveTo(a, y);
        g.lineTo(b, y);
        g.moveTo(b, y - 4);
        g.lineTo(b, y + 4);
        g.stroke();
        g.fillStyle = lane.color;
        g.textAlign = "center";
        g.textBaseline = "bottom";
        const emitting = time < lane.dur;
        g.fillText(`${fmtLength(front - back)}${emitting ? " (still emitting)" : ""}`, (a + b) / 2, y - 4);
      }

      if (i === 0) {
        g.strokeStyle = grid;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, CLOCK_H + LANE_H);
        g.lineTo(width, CLOCK_H + LANE_H);
        g.stroke();
      }
    });

    // distance axis
    const axisY = CLOCK_H + LANE_H * 2;
    g.fillStyle = muted;
    g.strokeStyle = grid;
    g.lineWidth = 1;
    g.textAlign = "center";
    g.textBaseline = "top";
    for (const { v, label } of ticks(Math.max(0, x0), x1, Math.max(2, Math.floor(plotW / 70)))) {
      g.beginPath();
      g.moveTo(sx(v), axisY);
      g.lineTo(sx(v), axisY + 4);
      g.stroke();
      g.fillText(`${label} m`, sx(v), axisY + 6);
    }
    g.fillStyle = text;
    g.font = `bold 12px ${css.getPropertyValue("--font-interface").trim() || "sans-serif"}`;
    g.fillText("TX", sx(0), axisY + 22);
    g.fillText("RX", sx(d), axisY + 22);

    // clock, top-right
    g.fillStyle = text;
    g.textAlign = "right";
    g.textBaseline = "top";
    g.font = `bold 18px ${css.getPropertyValue("--font-monospace").trim() || "monospace"}`;
    g.fillText(`t = ${time.toFixed(2)} ns`, width - PAD.right, 4);
    g.fillStyle = muted;
    g.textAlign = "left";
    g.font = `11px ${css.getPropertyValue("--font-interface").trim() || "sans-serif"}`;
    g.fillText(`each tick: +${fmt(cfg.step)} ns every ${fmt(cfg.tick)} s`, 4, 8);
  }
}

/*
 * ```slice
 * source: 100     # bandwidth of the original signal (MHz); its bump is 1000/source ns wide
 * cut: 2          # how long the switch stays on (ns)
 * smooth: 0       # 0 = hard on/off switch, 1 = smooth Gaussian gate (width at half height = cut)
 * carrier: 8      # GHz; only changes the wiggles in the time panel
 * span: 1500      # spectrum x range: carrier ± span (MHz)
 * ```
 * Every line is optional; each value is also a control.
 */
const SLICE_DEFAULTS = { source: 100, cut: 2, smooth: 0, carrier: 8, span: 1500 };
const CHANNEL_MHZ = 499.2; // 802.15.4 HRP UWB channel width
const FWHM_PER_SIGMA = 2 * Math.sqrt(2 * Math.LN2);
const DB_FLOOR = -40;
const CAPTION_H = 18;
const TIME_H = 200;
const SPEC_H = 240;
const SLICE_H = TIME_H + SPEC_H;

// Baseband envelopes with peak 1 at t = 0 (ns). The carrier multiplies all of them and only
// moves the spectrum to the carrier frequency, so spectra are computed on the envelopes.
function sliceModel(cfg) {
  const { gauss } = HELPERS;
  const srcFwhm = 1000 / cfg.source;
  const sigmaSrc = srcFwhm / FWHM_PER_SIGMA;
  const sigmaGate = cfg.cut / FWHM_PER_SIGMA;
  const half = cfg.cut / 2;
  const source = (t) => gauss(t, sigmaSrc);
  const gate = cfg.smooth ? (t) => gauss(t, sigmaGate) : (t) => (Math.abs(t) <= half ? 1 : 0);
  const sliced = (t) => source(t) * gate(t);
  const srcReach = 5 * sigmaSrc;
  const slicedReach = Math.min(srcReach, cfg.smooth ? 5 * sigmaGate : half);
  return { srcFwhm, source, gate, sliced, srcReach, slicedReach };
}

// Even, real envelope e(t) that is ~0 beyond ±reach  ->  X(f) = ∫ e(t) cos(2π f t) dt, f in GHz.
// Midpoint samples on [0, reach] never straddle a hard gate edge placed at reach.
function spectrumOf(e, reach, n = 600) {
  const dt = reach / n;
  const ts = new Float64Array(n);
  const es = new Float64Array(n);
  let energy = 0;
  for (let k = 0; k < n; k++) {
    ts[k] = (k + 0.5) * dt;
    es[k] = e(ts[k]);
    energy += 2 * es[k] * es[k] * dt;
  }
  const X = (f) => {
    let s = 0;
    for (let k = 0; k < n; k++) s += es[k] * Math.cos(2 * Math.PI * f * ts[k]);
    return 2 * s * dt;
  };
  const peak = X(0) ** 2;
  return { X, energy, db: (f) => 10 * Math.log10(X(f) ** 2 / peak) };
}

// Full width (MHz) where power first drops 10 dB below the peak at f = 0.
function width10dB(spec, stepGHz) {
  let prev = 0;
  for (let i = 1; i < 1e5; i++) {
    const db = spec.db(i * stepGHz);
    if (db < -10) return 2000 * stepGHz * (i - 1 + (prev + 10) / (prev - db));
    prev = db;
  }
  return Infinity;
}

// Share of the pulse's energy that lands inside the UWB channel around the carrier.
function channelShare(spec, n = 200) {
  const b = CHANNEL_MHZ / 2000;
  let s = 0;
  for (let k = 0; k < n; k++) s += spec.X(((k + 0.5) * b) / n) ** 2;
  return (2 * s * b) / n / spec.energy;
}

// Grid, tick labels and x label for one panel; returns data -> pixel maps.
function drawAxes(g, box, colors) {
  const { left, top, w, h, x0, x1, y0, y1, xlabel, yTicks } = box;
  const sx = (x) => left + ((x - x0) / (x1 - x0)) * w;
  const sy = (y) => top + (1 - (y - y0) / (y1 - y0)) * h;
  g.lineWidth = 1;
  g.setLineDash([]);
  g.strokeStyle = colors.grid;
  g.fillStyle = colors.muted;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const { v, label } of ticks(x0, x1, Math.max(2, Math.floor(w / 80)))) {
    g.beginPath();
    g.moveTo(sx(v), top);
    g.lineTo(sx(v), top + h);
    g.stroke();
    g.fillText(label, sx(v), top + h + 4);
  }
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (const { v, label } of yTicks) {
    g.beginPath();
    g.moveTo(left, sy(v));
    g.lineTo(left + w, sy(v));
    g.stroke();
    g.fillText(label, left - 6, sy(v));
  }
  g.textBaseline = "bottom";
  g.fillText(xlabel, left + w, top + h + PAD.bottom - 1);
  return { sx, sy };
}

function strokeCurve(g, n, point) {
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const [x, y] = point(k);
    k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}

// A long, narrowband signal switched on for `cut` ns: time on top, spectrum below.
class SliceSim extends MarkdownRenderChild {
  constructor(containerEl, cfg) {
    super(containerEl);
    this.cfg = cfg;
    this.frame = 0;
  }

  onload() {
    const root = this.containerEl;
    root.classList.add("wave-plot");
    root.appendChild(el("div", "wave-plot-title", "Slicing a narrowband signal: what the cut does to its spectrum"));

    this.canvas = el("canvas", "wave-plot-canvas");
    this.canvas.style.height = `${SLICE_H}px`;
    root.appendChild(this.canvas);

    const legend = el("div", "wave-plot-legend");
    [
      ["original signal, never switched off", PALETTE[1], true],
      ["what the antenna emits after slicing", PALETTE[0], false],
      ["the switch (gate)", "#888", true],
    ].forEach(([label, color, dashed]) => {
      const item = el("span", "wave-plot-legend-item");
      const swatch = el("span", `wave-plot-swatch${dashed ? " is-dashed" : ""}`);
      swatch.style.borderColor = color;
      item.append(swatch, document.createTextNode(label));
      legend.appendChild(item);
    });
    root.appendChild(legend);

    const controls = el("div", "wave-plot-controls");
    const gateBtn = el("button");
    const gateLabel = () => (gateBtn.textContent = this.cfg.smooth ? "Gate: smooth fade" : "Gate: hard on/off switch");
    gateLabel();
    gateBtn.addEventListener("click", () => {
      this.cfg.smooth = this.cfg.smooth ? 0 : 1;
      gateLabel();
      this.schedule();
    });
    controls.appendChild(gateBtn);
    root.appendChild(controls);

    const knob = (key, label, min, max, step) =>
      makeSlider(
        root,
        { label, value: this.cfg[key], min, max, step },
        (v) => {
          if (v <= 0) return;
          this.cfg[key] = v;
          this.schedule();
        },
        "is-wide",
      );
    knob("source", "original bandwidth (MHz)", 10, 1000, 10);
    knob("cut", "switched on for (ns)", 0.2, 30, 0.1);
    knob("carrier", "carrier (GHz)", 0.5, 10, 0.1);
    knob("span", "spectrum ± (MHz)", 200, 5000, 100);

    this.readoutEls = [0, 1, 2, 3].map(() => el("div", "wave-plot-readout"));
    this.readoutEls.forEach((r) => root.appendChild(r));

    this.resizer = new ResizeObserver(() => this.schedule());
    this.resizer.observe(this.canvas);
    this.schedule();
  }

  onunload() {
    this.resizer.disconnect();
    cancelAnimationFrame(this.frame);
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  draw() {
    const { canvas, cfg } = this;
    const width = canvas.clientWidth;
    if (!width) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(SLICE_H * dpr)) canvas.height = Math.round(SLICE_H * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, SLICE_H);

    const css = getComputedStyle(this.containerEl);
    const colors = {
      muted: css.getPropertyValue("--text-muted").trim() || "#888",
      grid: css.getPropertyValue("--background-modifier-border").trim() || "#ddd",
    };
    const font = css.getPropertyValue("--font-interface").trim() || "sans-serif";
    g.font = `11px ${font}`;
    const [orange, blue, green] = [PALETTE[1], PALETTE[0], PALETTE[2]];
    const left = PAD.left;
    const w = width - PAD.left - PAD.right;

    const m = sliceModel(cfg);
    const srcSpec = spectrumOf(m.source, m.srcReach);
    const slicedSpec = spectrumOf(m.sliced, m.slicedReach);
    const srcBw = width10dB(srcSpec, cfg.source / 1000 / 400);
    const slicedBw = width10dB(slicedSpec, 1 / Math.min(cfg.cut, m.srcFwhm) / 400);

    const caption = (text, y) => {
      g.fillStyle = colors.muted;
      g.textAlign = "left";
      g.textBaseline = "top";
      g.font = `bold 11px ${font}`;
      g.fillText(text, left, y + 2);
      g.font = `11px ${font}`;
    };

    // Time panel: envelopes at baseband, carrier wiggles under the sliced one.
    {
      const top = CAPTION_H;
      const h = TIME_H - CAPTION_H - PAD.bottom;
      const half = Math.max(1.2 * m.srcFwhm, 0.75 * cfg.cut);
      caption("TIME: what goes out of the antenna", 0);
      const { sx, sy } = drawAxes(
        g,
        { left, top, w, h, x0: -half, x1: half, y0: -1.15, y1: 1.15, xlabel: "t (ns)", yTicks: ticks(-1, 1, 4) },
        colors,
      );
      const n = Math.ceil(w * 6);
      const tAt = (k) => -half + (2 * half * k) / n;
      g.save();
      g.beginPath();
      g.rect(left, top, w, h);
      g.clip();

      g.strokeStyle = blue;
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      strokeCurve(g, n, (k) => [sx(tAt(k)), sy(m.sliced(tAt(k)) * Math.cos(2 * Math.PI * cfg.carrier * tAt(k)))]);
      g.globalAlpha = 1;
      g.lineWidth = 2;
      for (const s of [1, -1]) strokeCurve(g, n, (k) => [sx(tAt(k)), sy(s * m.sliced(tAt(k)))]);

      g.lineWidth = 1.5;
      g.setLineDash([6, 4]);
      g.strokeStyle = orange;
      for (const s of [1, -1]) strokeCurve(g, n, (k) => [sx(tAt(k)), sy(s * m.source(tAt(k)))]);

      g.strokeStyle = "#888";
      g.setLineDash([3, 3]);
      if (cfg.smooth) {
        strokeCurve(g, n, (k) => [sx(tAt(k)), sy(m.gate(tAt(k)))]);
      } else {
        const edge = cfg.cut / 2;
        const corners = [[-half, 0], [-edge, 0], [-edge, 1], [edge, 1], [edge, 0], [half, 0]];
        strokeCurve(g, corners.length - 1, (k) => [sx(corners[k][0]), sy(corners[k][1])]);
      }
      g.restore();
    }

    // Spectrum panel: power in dB relative to each signal's own peak, around the carrier.
    {
      const top = TIME_H + CAPTION_H;
      const h = SPEC_H - CAPTION_H - PAD.bottom;
      const span = cfg.span;
      caption("SPECTRUM: which frequencies that signal contains", TIME_H);
      const { sx, sy } = drawAxes(
        g,
        {
          left,
          top,
          w,
          h,
          x0: -span,
          x1: span,
          y0: DB_FLOOR,
          y1: 3,
          xlabel: `offset from the ${fmt(cfg.carrier)} GHz carrier (MHz)`,
          yTicks: ticks(DB_FLOOR, 0, 4).map((t) => ({ ...t, label: `${t.label} dB` })),
        },
        colors,
      );
      g.save();
      g.beginPath();
      g.rect(left, top, w, h);
      g.clip();

      g.fillStyle = green;
      g.globalAlpha = 0.12;
      g.fillRect(sx(-CHANNEL_MHZ / 2), top, sx(CHANNEL_MHZ / 2) - sx(-CHANNEL_MHZ / 2), h);
      g.globalAlpha = 1;
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillText(`${CHANNEL_MHZ} MHz UWB channel`, sx(0), top + 2);

      g.strokeStyle = colors.muted;
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(left, sy(-10));
      g.lineTo(left + w, sy(-10));
      g.stroke();
      g.setLineDash([]);

      const n = Math.ceil(w);
      const fAt = (k) => -span + (2 * span * k) / n;
      const clampDb = (db) => Math.max(DB_FLOOR - 5, db);
      g.lineWidth = 2;
      g.strokeStyle = blue;
      strokeCurve(g, n, (k) => [sx(fAt(k)), sy(clampDb(slicedSpec.db(fAt(k) / 1000)))]);
      g.lineWidth = 1.5;
      g.strokeStyle = orange;
      g.setLineDash([6, 4]);
      strokeCurve(g, n, (k) => [sx(fAt(k)), sy(clampDb(srcSpec.db(fAt(k) / 1000)))]);
      g.setLineDash([]);

      // -10 dB bracket on the sliced spectrum
      const [a, b, y] = [sx(-slicedBw / 2), sx(slicedBw / 2), sy(-10)];
      g.strokeStyle = blue;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(a, y - 5);
      g.lineTo(a, y + 5);
      g.moveTo(a, y);
      g.lineTo(b, y);
      g.moveTo(b, y - 5);
      g.lineTo(b, y + 5);
      g.stroke();
      g.fillStyle = blue;
      g.textAlign = "left";
      g.textBaseline = "bottom";
      g.fillText(`${Math.round(slicedBw)} MHz at −10 dB`, b + 4, y - 2);
      g.restore();
    }

    const gateName = cfg.smooth ? "smooth fade" : "hard switch";
    const pct = (x) => `${(100 * (1 - Math.min(1, x))).toFixed(1)}%`;
    const [r0, r1, r2, r3] = this.readoutEls;
    r0.textContent = `original: ${fmt(m.srcFwhm)} ns bump → ${Math.round(srcBw)} MHz wide at −10 dB`;
    r1.textContent = `sliced to ${fmt(cfg.cut)} ns (${gateName}) → ${Math.round(slicedBw)} MHz wide at −10 dB`;
    r2.textContent = `rule of thumb 1 / (switched-on time) = ${Math.round(1000 / cfg.cut)} MHz`;
    r3.textContent = `energy spilling outside the ${CHANNEL_MHZ} MHz channel: original ${pct(channelShare(srcSpec))}, sliced ${pct(channelShare(slicedSpec))}`;
  }
}

// Match the Obsidian code block processors: parse errors appear inline with the language prefix.
export function mountWaveBlock(lang, source, container) {
  const blocks = {
    wave: [parseSpec, WavePlot],
    pulse: [parseKeys(PULSE_DEFAULTS), PulseSim],
    slice: [parseKeys(SLICE_DEFAULTS), SliceSim],
  };
  const block = blocks[lang];
  if (!block) throw new Error(`Unsupported wave block: ${lang}`);
  container.replaceChildren();
  let parsed;
  try {
    parsed = block[0](source);
  } catch (e) {
    container.appendChild(el("div", "wave-plot-error", `${lang}: ${e.message}`));
    return () => container.replaceChildren();
  }
  const view = new block[1](container, parsed);
  view.onload();
  return () => {
    view.onunload();
    container.replaceChildren();
  };
}
