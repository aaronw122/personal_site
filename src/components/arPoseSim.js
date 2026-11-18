class MarkdownRenderChild {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";
const W = 760;
const H = 480;
const SCALE = 190;
const CENTER_Y = H * 0.36;
const HALF = [0.36, 0.17, 0.026];
const ARROW = 0.6;
const FLOOR = -1;
const GRID = 1.2;
const DEG = 180 / Math.PI;
const EPS = 0.004;
const LENS = [-HALF[0] + 0.05, HALF[1] - 0.05, -HALF[2]];

const COLUMNS = [
  { label: "bottom (col 0)", cls: "is-c0", tip: "col 0 · bottom" },
  { label: "right edge (col 1)", cls: "is-c1", tip: "col 1 · right edge" },
  { label: "screen (col 2)", cls: "is-c2", tip: "col 2 · screen" },
  { label: "position (col 3)", cls: "is-c3" },
];

const ROWS = ["x (right of start)", "y (up)", "z (behind start)", "w (homogeneous coordinate)"];

const FACES = [
  { axis: 2, sign: 1, cls: "is-screen" },
  { axis: 2, sign: -1, cls: "is-back" },
  { axis: 0, sign: 1, cls: "is-end" },
  { axis: 0, sign: -1, cls: "is-end" },
  { axis: 1, sign: 1, cls: "is-side" },
  { axis: 1, sign: -1, cls: "is-side" },
];

const PORTRAIT = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
];

const ANGLES = [
  { key: "yaw", label: "yaw", min: -180, max: 180 },
  { key: "pitch", label: "pitch", min: -90, max: 90 },
  { key: "roll", label: "roll", min: -180, max: 180 },
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

const rotX = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
};
const rotY = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};
const rotZ = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};
const rotAxis = (v, k, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
};

const fromAngles = ({ yaw, pitch, roll }) => PORTRAIT.map((col) => rotY(rotX(rotZ(col, -roll), pitch), -yaw));

function toAngles(cols, prevYaw) {
  const f = mul(cols[2], -1);
  const pitch = Math.asin(clamp(f[1], -1, 1));
  const yaw = Math.cos(pitch) > 1e-4 ? Math.atan2(f[0], -f[2]) : prevYaw;
  const right = rotX(rotY(cols[1], yaw), -pitch);
  return { yaw, pitch, roll: Math.atan2(-right[1], right[0]) };
}

function orthonormalize(cols) {
  const c0 = norm(cols[0]);
  const c1 = norm(sub(cols[1], mul(c0, dot(cols[1], c0))));
  return [c0, c1, cross(c0, c1)];
}

function perpendicular(v) {
  const axis = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return norm(cross(v, axis));
}

function svg(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

function html(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

class PoseSim extends MarkdownRenderChild {
  constructor(containerEl, focus) {
    super(containerEl);
    this.focus = focus;
    this.cols = PORTRAIT.map((c) => c.slice());
    this.pos = [0, 0, 0];
    this.angles = { yaw: 0, pitch: 0, roll: 0 };
    this.viewYaw = -0.6;
    this.viewPitch = 0.35;
    this.frame = { w: W, h: H, scale: SCALE * 0.82, cx: W * 0.34, cy: CENTER_Y + 20, target: [0, 0, 0] };
    this.message = "";
    this.cleanup = [];
  }

  on(target, type, handler) {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  onload() {
    const root = html("div", "ar-pose", this.containerEl);
    const stage = html("div", "ar-pose-stage", root);
    this.svg = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "ar-pose-svg" }, stage);
    this.layer = svg("g", {}, this.svg);
    this.buildControls(stage);
    const panel = html("div", "ar-pose-panel", root);
    this.buildMatrix(panel);
    this.readout = html("div", "ar-pose-readout", root);
    this.on(this.svg, "pointerdown", this.pointerDown);
    this.on(this.svg, "pointermove", this.pointerMove);
    this.on(this.svg, "pointerup", this.pointerUp);
    this.on(this.svg, "pointercancel", this.pointerUp);
    this.render();
  }

  onunload() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  buildMatrix(panel) {
    const grid = html("div", "ar-pose-matrix", panel);
    COLUMNS.forEach((c, i) => html("div", `ar-pose-head ${c.cls}${this.muted(i)}`, grid, c.label));
    html("div", "", grid);
    this.inputs = [];
    for (let row = 0; row < 4; row++) {
      const inputs = [];
      for (let col = 0; col < 4; col++) {
        const edge = col === 0 ? " is-left" : col === 3 ? " is-right" : "";
        const cell = html("div", `ar-pose-cell ${COLUMNS[col].cls}${edge}${this.muted(col)}`, grid);
        if (row === 3) {
          html("span", "ar-pose-fixed", cell, col === 3 ? "1" : "0");
          continue;
        }
        const input = html("input", "ar-pose-input", cell);
        input.type = "number";
        input.step = col === 3 ? "0.1" : "0.05";
        input.disabled = this.muted(col) !== "";
        this.on(input, "change", () => this.editCell(row, col, parseFloat(input.value)));
        inputs.push(input);
      }
      if (row < 3) this.inputs.push(inputs);
      html("div", `ar-pose-row${row === 3 ? " is-fixed" : ""}`, grid, ROWS[row]);
    }
  }

  muted(col) {
    return this.focus === undefined || this.focus === col ? "" : " is-muted";
  }

  slider(box, label, min, max, step, onInput) {
    const line = html("label", "ar-pose-slider", box);
    html("span", "", line, label);
    const input = html("input", "", line);
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    const value = html("span", "ar-pose-mono", line);
    this.on(input, "input", () => onInput(parseFloat(input.value)));
    return { input, value };
  }

  buildControls(panel) {
    const box = html("div", "ar-pose-controls", panel);
    this.sliders = {};
    this.posSliders = [];
    if (this.focus !== 3) {
      for (const a of ANGLES) {
        const s = this.slider(box, a.label, a.min, a.max, 1, (v) => {
          this.angles[a.key] = v / DEG;
          this.message = "";
          this.active = true;
          this.setPose(fromAngles(this.angles), true);
        });
        this.on(s.input, "pointerdown", () => this.setActive(true));
        this.on(s.input, "pointerup", () => this.setActive(false));
        this.on(s.input, "change", () => this.setActive(false));
        this.on(s.input, "blur", () => this.setActive(false));
        this.sliders[a.key] = s;
      }
    }
    if (this.focus === 3 || this.focus === undefined) {
      ["x", "y", "z"].forEach((axis, i) => {
        this.posSliders.push(
          this.slider(box, axis, -GRID, GRID, 0.05, (v) => {
            this.pos[i] = v;
            this.render();
          }),
        );
      });
    }
    const presets = html("div", "ar-pose-presets", box);
    const reset = html("button", "", presets, "reset");
    this.on(reset, "click", () => {
      this.pos = [0, 0, 0];
      this.message = "";
      this.setPose(PORTRAIT.map((c) => c.slice()));
    });
  }

  setPose(cols, fromSliders = false) {
    this.cols = cols;
    if (!fromSliders) this.angles = toAngles(cols, this.angles.yaw);
    this.render();
  }

  editCell(row, col, value) {
    if (Number.isNaN(value)) return this.render();
    if (col === 3) {
      this.pos[row] = value;
      this.message = "";
      return this.render();
    }
    const v = clamp(value, -1, 1);
    const target = this.cols[col].slice();
    const others = [0, 1, 2].filter((i) => i !== row);
    const rest = Math.hypot(target[others[0]], target[others[1]]);
    const keep = Math.sqrt(1 - v * v);
    if (rest < 1e-6) {
      target[others[0]] = keep;
      target[others[1]] = 0;
    } else {
      target[others[0]] *= keep / rest;
      target[others[1]] *= keep / rest;
    }
    target[row] = v;
    const next = (col + 1) % 3;
    const last = (col + 2) % 3;
    let partner = sub(this.cols[next], mul(target, dot(this.cols[next], target)));
    partner = len(partner) < 1e-6 ? perpendicular(target) : norm(partner);
    const cols = [];
    cols[col] = target;
    cols[next] = partner;
    cols[last] = cross(target, partner);
    const axis = "xyz"[row];
    this.message =
      `you set col ${col}.${axis} = ${fmt(v)}${v !== value ? ` (clamped, a unit arrow can't exceed ±1)` : ""}. ` +
      `to stay a valid rotation (each column length 1, all three at 90°), the rest of col ${col} was rescaled, ` +
      `col ${next} was bent to stay perpendicular, and col ${last} = col ${col} × col ${next}.`;
    this.setPose(cols);
  }

  view(v) {
    return rotX(rotY(v, this.viewYaw), this.viewPitch);
  }

  unview(v) {
    return rotY(rotX(v, -this.viewPitch), -this.viewYaw);
  }

  project(p) {
    const f = this.frame;
    const a = this.view(sub(p, f.target));
    return [(f.cx ?? f.w / 2) + a[0] * f.scale, f.cy - a[1] * f.scale, a[2]];
  }

  local(p) {
    const c = this.cols;
    const q = sub(p, LENS);
    return add(this.pos, add(add(mul(c[0], q[0]), mul(c[1], q[1])), mul(c[2], q[2])));
  }

  pointerDown = (evt) => {
    const onPhone = evt.target.closest && evt.target.closest(".ar-pose-phone");
    this.drag = { x: evt.clientX, y: evt.clientY, mode: onPhone ? "phone" : "view" };
    this.svg.setPointerCapture(evt.pointerId);
  };

  pointerMove = (evt) => {
    if (!this.drag) return;
    const dx = (evt.clientX - this.drag.x) * 0.01;
    const dy = (evt.clientY - this.drag.y) * 0.01;
    this.drag.x = evt.clientX;
    this.drag.y = evt.clientY;
    if (this.drag.mode === "view") {
      this.viewYaw += dx;
      this.viewPitch = clamp(this.viewPitch + dy, -1.45, 1.45);
      return this.render();
    }
    if (this.focus === 3) {
      const side = this.unview([1, 0, 0]);
      const flat = norm([side[0], 0, side[2]]);
      const move = add(mul(flat, dx * 0.5), [0, -dy * 0.5, 0]);
      this.pos = this.pos.map((v, i) => clamp(v + move[i], -GRID, GRID));
      return this.render();
    }
    const up = this.unview([0, 1, 0]);
    const right = this.unview([1, 0, 0]);
    const cols = this.cols.map((c) => rotAxis(rotAxis(c, up, dx), right, dy));
    this.message = "";
    this.active = true;
    this.setPose(orthonormalize(cols));
  };

  pointerUp = (evt) => {
    this.drag = null;
    if (this.svg.hasPointerCapture(evt.pointerId)) this.svg.releasePointerCapture(evt.pointerId);
    this.setActive(false);
  };

  setActive(key) {
    if (this.active === key) return;
    this.active = key;
    this.render();
  }

  poly(points, cls, parent) {
    const pts = points.map((p) => {
      const s = this.project(this.local(p));
      return `${s[0].toFixed(1)},${s[1].toFixed(1)}`;
    });
    return svg("polygon", { points: pts.join(" "), class: cls }, parent);
  }

  rect(axis, sign, u, v, u0, u1, v0, v1, cls, parent) {
    const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([a, b]) => {
      const p = [0, 0, 0];
      p[axis] = sign * (HALF[axis] + EPS);
      p[u] = a;
      p[v] = b;
      return p;
    });
    return this.poly(corners, cls, parent);
  }

  circle(center, r, cls, parent) {
    const points = [];
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) * Math.PI * 2;
      points.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t), center[2]]);
    }
    return this.poly(points, cls, parent);
  }

  arrow(from, dir, length, cls, label) {
    const a = this.project(from);
    const b = this.project(add(from, mul(dir, length)));
    svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `ar-pose-arrow ${cls}` }, this.layer);
    const d = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(d[0], d[1]);
    if (l < 6) {
      svg("circle", { cx: b[0], cy: b[1], r: 4, class: `ar-pose-tip ${cls}` }, this.layer);
    } else {
      const u = [d[0] / l, d[1] / l];
      const n = [-u[1], u[0]];
      const base = [b[0] - u[0] * 11, b[1] - u[1] * 11];
      const pts = [[b[0], b[1]], [base[0] + n[0] * 5, base[1] + n[1] * 5], [base[0] - n[0] * 5, base[1] - n[1] * 5]];
      svg("polygon", { points: pts.map((p) => p.join(",")).join(" "), class: `ar-pose-tip ${cls}` }, this.layer);
    }
    if (!label) return;
    const off = l < 6 ? [10, -10] : [(d[0] / l) * 16, (d[1] / l) * 16];
    const t = svg("text", { x: b[0] + off[0], y: b[1] + off[1] + 4, class: `ar-pose-label ${cls}`, "text-anchor": "middle" }, this.layer);
    t.textContent = label;
  }

  drawGrid(center, half, y) {
    for (let k = -half; k <= half + 1e-9; k += half / 3) {
      const a = this.project([center[0] + k, y, center[2] - half]);
      const b = this.project([center[0] + k, y, center[2] + half]);
      const c = this.project([center[0] - half, y, center[2] + k]);
      const d = this.project([center[0] + half, y, center[2] + k]);
      svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "ar-pose-grid" }, this.layer);
      svg("line", { x1: c[0], y1: c[1], x2: d[0], y2: d[1], class: "ar-pose-grid" }, this.layer);
    }
  }

  drawOrigin() {
    const o = this.project([0, 0, 0]);
    svg("path", { d: `M${o[0] - 5},${o[1] - 5}L${o[0] + 5},${o[1] + 5}M${o[0] + 5},${o[1] - 5}L${o[0] - 5},${o[1] + 5}`, class: "ar-pose-origin" }, this.layer);
  }

  drawFloor() {
    this.drawGrid([0, 0, 0], GRID, FLOOR);
    this.drawOrigin();
    if (this.focus !== undefined && this.focus !== 3) return;
    const top = this.project(this.pos);
    const shadow = this.project([this.pos[0], FLOOR, this.pos[2]]);
    svg("line", { x1: top[0], y1: top[1], x2: shadow[0], y2: shadow[1], class: "ar-pose-drop" }, this.layer);
    svg("ellipse", { cx: shadow[0], cy: shadow[1], rx: 10, ry: 4, class: "ar-pose-shadow" }, this.layer);
    const t = svg("text", { x: shadow[0], y: shadow[1] + 20, class: "ar-pose-dim", "text-anchor": "middle" }, this.layer);
    t.textContent = `floor shadow (y = ${FLOOR} m) · ✕ = origin, where the session started`;
  }

  drawLegs(origin, values, scale, unit) {
    const [x, y, z] = values.map((v) => v * scale);
    const corners = [[0, 0, 0], [x, 0, 0], [x, 0, z], [x, y, z]].map((p) => this.project(add(origin, p)));
    const parts = [
      ["x", values[0], 0, 18, "middle"],
      ["z", values[2], -10, 4, "end"],
      ["y", values[1], 10, 4, "start"],
    ];
    parts.forEach(([axis, v, dx, dy, anchor], i) => {
      if (Math.abs(v) < 0.01) return;
      const a = corners[i];
      const b = corners[i + 1];
      svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "ar-pose-leg" }, this.layer);
      const t = svg("text", { x: (a[0] + b[0]) / 2 + dx, y: (a[1] + b[1]) / 2 + dy, class: "ar-pose-leg-label", "text-anchor": anchor }, this.layer);
      t.textContent = `${axis} = ${fmt(v)}${unit}`;
    });
  }

  drawPositionPath() {
    this.drawLegs([0, 0, 0], this.pos, 1, " m");
    if (len(this.pos) > 0.03) this.arrow([0, 0, 0], norm(this.pos), len(this.pos), "is-c3", "col 3 · position");
  }

  drawLocalAxes(center, reach) {
    for (const [name, v] of [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]]) {
      const a = this.project(add(center, mul(v, -reach)));
      const b = this.project(add(center, mul(v, reach)));
      svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "ar-pose-axis" }, this.layer);
      const plus = svg("text", { x: b[0], y: b[1] - 6, class: "ar-pose-axis-label", "text-anchor": "middle" }, this.layer);
      plus.textContent = `+${name}`;
      const minus = svg("text", { x: a[0], y: a[1] - 6, class: "ar-pose-axis-label", "text-anchor": "middle" }, this.layer);
      minus.textContent = `−${name}`;
    }
  }

  drawSphere() {
    const c = this.project(this.pos);
    const r = ARROW * this.frame.scale;
    svg("circle", { cx: c[0], cy: c[1], r, class: "ar-pose-sphere" }, this.layer);
    for (const ring of [(t) => [Math.cos(t), 0, Math.sin(t)], (t) => [Math.cos(t), Math.sin(t), 0], (t) => [0, Math.cos(t), Math.sin(t)]]) {
      const points = [];
      for (let i = 0; i <= 64; i++) points.push(this.project(add(this.pos, mul(ring((i / 64) * Math.PI * 2), ARROW))));
      svg("polyline", { points: points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), class: "ar-pose-sphere-line" }, this.layer);
    }
    const t = svg("text", { x: c[0], y: c[1] - r - 10, class: "ar-pose-sphere-label", "text-anchor": "middle" }, this.layer);
    if (this.focus === undefined) {
      t.textContent = `every arrow has length √(x² + y² + z²) = 1 · each tip can only sit on this sphere`;
    } else {
      t.textContent = `length = √(x² + y² + z²) = ${fmt(len(this.cols[this.focus]))} · the tip can only sit on this sphere`;
    }
  }

  drawGizmo() {
    const g = [70, this.frame.h - 70];
    const axes = [
      [[1, 0, 0], "+X"],
      [[0, 1, 0], "+Y"],
      [[0, 0, -1], "−Z"],
    ];
    for (const [v, name] of axes) {
      const d = this.view(v);
      const e = [g[0] + d[0] * 38, g[1] - d[1] * 38];
      svg("line", { x1: g[0], y1: g[1], x2: e[0], y2: e[1], class: "ar-pose-gizmo" }, this.layer);
      const t = svg("text", { x: e[0] + d[0] * 10, y: e[1] - d[1] * 10 + 4, class: "ar-pose-dim", "text-anchor": "middle" }, this.layer);
      t.textContent = name;
    }
    const t = svg("text", { x: g[0], y: this.frame.h - 8, class: "ar-pose-dim", "text-anchor": "middle" }, this.layer);
    t.textContent = "world axes";
  }

  drawPhone() {
    const group = svg("g", { class: "ar-pose-phone" }, this.layer);
    for (const f of FACES) {
      const normal = mul(this.cols[f.axis], f.sign);
      if (this.view(normal)[2] <= 0) continue;
      const [u, v] = [0, 1, 2].filter((i) => i !== f.axis);
      this.rect(f.axis, f.sign, u, v, -HALF[u], HALF[u], -HALF[v], HALF[v], `ar-pose-face ${f.cls}`, group);
      if (f.cls === "is-screen") {
        this.rect(2, 1, 0, 1, -HALF[0] + 0.02, HALF[0] - 0.02, -HALF[1] + 0.015, HALF[1] - 0.015, "ar-pose-display", group);
        this.rect(2, 1, 0, 1, -HALF[0] + 0.03, -HALF[0] + 0.045, -0.04, 0.04, "ar-pose-island", group);
      } else if (f.cls === "is-back") {
        const z = -HALF[2] - EPS;
        this.rect(2, -1, 0, 1, -HALF[0] + 0.015, -HALF[0] + 0.145, HALF[1] - 0.145, HALF[1] - 0.015, "ar-pose-bump", group);
        this.circle([LENS[0], LENS[1], z - EPS], 0.027, "ar-pose-lens is-main", group);
        this.circle([-HALF[0] + 0.11, HALF[1] - 0.11, z - EPS], 0.027, "ar-pose-lens", group);
      } else if (f.axis === 0 && f.sign === 1) {
        this.rect(0, 1, 1, 2, -0.035, 0.035, -0.009, 0.009, "ar-pose-port", group);
      }
    }
  }

  drawScene() {
    this.layer.replaceChildren();
    this.drawFloor();
    this.drawGizmo();
    const arrows = [0, 1, 2].map((i) => ({
      col: i,
      dir: this.cols[i],
      length: ARROW,
      cls: COLUMNS[i].cls,
      label: COLUMNS[i].tip,
    }));
    const shown = arrows.filter((a) => this.focus === undefined || this.focus === a.col);
    const directional = this.focus !== 3;
    this.drawLocalAxes(directional ? this.pos : [0, 0, 0], directional ? ARROW * 1.2 : 0.8);
    if (directional && this.active) this.drawSphere();
    const behind = shown.filter((a) => this.view(a.dir)[2] < 0);
    const front = shown.filter((a) => this.view(a.dir)[2] >= 0);
    behind.forEach((a) => this.arrow(this.pos, a.dir, a.length, a.cls, a.label));
    this.drawPhone();
    if (this.focus !== undefined && directional) this.drawLegs(this.pos, this.cols[this.focus], ARROW, "");
    front.forEach((a) => this.arrow(this.pos, a.dir, a.length, a.cls, a.label));
    if (this.focus === 3) this.drawPositionPath();
  }

  render() {
    this.drawScene();
    const values = [...this.cols, this.pos];
    this.inputs.forEach((inputs, row) =>
      inputs.forEach((input, col) => {
        if (document.activeElement !== input) input.value = fmt(values[col][row]);
      }),
    );
    for (const a of ANGLES) {
      const s = this.sliders[a.key];
      if (!s) continue;
      const deg = this.angles[a.key] * DEG;
      if (document.activeElement !== s.input) s.input.value = Math.round(deg);
      s.value.textContent = `${Math.round(deg)}°`;
    }
    this.posSliders.forEach((s, i) => {
      if (document.activeElement !== s.input) s.input.value = this.pos[i];
      s.value.textContent = `${fmt(this.pos[i])} m`;
    });
    this.readout.replaceChildren();
    if (this.message) html("div", "ar-pose-message", this.readout, this.message);
  }
}

const CUP_POSE = {
  cols: fromAngles({ yaw: -75 / DEG, pitch: -38 / DEG, roll: 6 / DEG }),
  pos: [0.34, 0.18, -0.47],
};
const CUP_LOCAL = [0, 0, -2];
const SCREEN = { w: 300, h: 480, cx: 150, cy: 240, focal: 220 };

class CupExample extends PoseSim {
  constructor(containerEl) {
    super(containerEl);
    this.cols = CUP_POSE.cols;
    this.pos = CUP_POSE.pos;
    this.cup = add(this.pos, CUP_LOCAL.reduce((sum, v, i) => add(sum, mul(this.cols[i], v)), [0, 0, 0]));
  }

  onload() {
    const root = html("div", "ar-pose ar-pose-example", this.containerEl);
    const left = html("div", "ar-pose-example-left", root);
    this.drawPositionView(left);
    this.buildStaticMatrix(left);
    this.drawCupView(html("div", "ar-pose-example-right", root));
  }

  buildStaticMatrix(parent) {
    const grid = html("div", "ar-pose-matrix is-static", parent);
    COLUMNS.forEach((c, i) => html("div", `ar-pose-head ${c.cls}`, grid, i === 3 ? "position" : c.tip.split(" · ")[1]));
    const values = [...this.cols, this.pos];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const edge = col === 0 ? " is-left" : col === 3 ? " is-right" : "";
        const cell = html("div", `ar-pose-cell ${COLUMNS[col].cls}${edge}`, grid);
        const text = row === 3 ? (col === 3 ? "1" : "0") : fmt(values[col][row]);
        html("span", row === 3 ? "ar-pose-fixed" : "ar-pose-value", cell, text);
      }
    }
  }

  scene(parent, w, h, scale, target, viewYaw, viewPitch, cy = h / 2) {
    this.root = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "ar-pose-svg is-static" }, parent);
    this.layer = svg("g", {}, this.root);
    this.frame = { w, h, scale, cy, target };
    this.viewYaw = viewYaw;
    this.viewPitch = viewPitch;
  }

  cropTo(points, pad, aspect) {
    const s = points.map((p) => this.project(p));
    const xs = s.map((p) => p[0]);
    const ys = s.map((p) => p[1]);
    let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
    const grow = (y1 - y0) * aspect - (x1 - x0);
    if (grow > 0) [x0, x1] = [x0 - grow / 2, x1 + grow / 2];
    this.root.setAttribute("viewBox", `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`);
  }

  drawPositionView(parent) {
    this.scene(parent, W, H, SCALE, [0, 0, 0], -0.6, 0.35, CENTER_Y);
    this.drawGrid([0, 0, 0], GRID, FLOOR);
    this.drawOrigin();
    const top = this.project(this.pos);
    const shadow = this.project([this.pos[0], FLOOR, this.pos[2]]);
    svg("line", { x1: top[0], y1: top[1], x2: shadow[0], y2: shadow[1], class: "ar-pose-drop" }, this.layer);
    svg("ellipse", { cx: shadow[0], cy: shadow[1], rx: 10, ry: 4, class: "ar-pose-shadow" }, this.layer);
    const reach = 0.9;
    this.drawLocalAxes([0, 0, 0], reach);
    this.drawPhone();
    this.drawLegs([0, 0, 0], this.pos, 1, " m");
    const ends = [[reach, 0, 0], [-reach, 0, 0], [0, reach, 0], [0, -reach, 0], [0, 0, reach], [0, 0, -reach]];
    this.cropTo([...ends, this.pos], 16, 1.2);
    this.root.classList.add("is-mini");
  }

  drawCup(parent, x, y) {
    const g = svg("g", { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, parent);
    svg("ellipse", { cx: 0, cy: 0, rx: 14, ry: 4, class: "ar-pose-cup-shadow" }, g);
    svg("path", { d: "M-11,-24 L11,-24 L8,-2 L-8,-2 Z", class: "ar-pose-cup-body" }, g);
    svg("ellipse", { cx: 0, cy: -24, rx: 11, ry: 3.5, class: "ar-pose-cup-rim" }, g);
    svg("path", { d: "M10,-19 C19,-19 19,-7 9,-8", class: "ar-pose-cup-handle" }, g);
  }

  toScreen(p) {
    const { cx, cy, focal } = SCREEN;
    const q = sub(p, this.pos);
    const depth = -dot(q, this.cols[2]);
    if (depth < 0.05) return null;
    return [cx + (dot(q, this.cols[1]) / depth) * focal, cy + (dot(q, this.cols[0]) / depth) * focal];
  }

  horizonAt(x0, x1) {
    const { cx, cy, focal } = SCREEN;
    const level = norm([-this.cols[2][0], 0, -this.cols[2][2]]);
    const [a, b] = [0.5, -0.5].map((t) => {
      const d = rotY(level, t);
      const depth = -dot(d, this.cols[2]);
      return [cx + (dot(d, this.cols[1]) / depth) * focal, cy + (dot(d, this.cols[0]) / depth) * focal];
    });
    const slope = (b[1] - a[1]) / (b[0] - a[0]);
    return [x0, x1].map((x) => [x, a[1] + slope * (x - a[0])]);
  }

  drawFloorGrid(parent, floorY) {
    const lines = [];
    for (let k = -4; k <= 4; k += 0.5) {
      lines.push([[this.cup[0] + k, floorY, this.cup[2] - 4], [this.cup[0] + k, floorY, this.cup[2] + 4]]);
      lines.push([[this.cup[0] - 4, floorY, this.cup[2] + k], [this.cup[0] + 4, floorY, this.cup[2] + k]]);
    }
    for (const [a, b] of lines) {
      let run = [];
      const flush = () => {
        if (run.length > 1) svg("polyline", { points: run.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), class: "ar-pose-feed-grid" }, parent);
        run = [];
      };
      for (let i = 0; i <= 60; i++) {
        const s = this.toScreen(add(a, mul(sub(b, a), i / 60)));
        if (s) run.push(s);
        else flush();
      }
      flush();
    }
  }

  drawCupView(parent) {
    const { w, h, cx, cy } = SCREEN;
    const display = { x: 50, y: 20, width: 200, height: 440, rx: 26 };
    const floorY = this.cup[1];
    const horizon = this.horizonAt(display.x, display.x + display.width);
    const cupBase = this.toScreen(this.cup);
    const root = svg("svg", { viewBox: `0 0 ${w} ${h}`, class: "ar-pose-svg is-static is-screen-view" }, parent);
    const clip = `ar-pose-clip-${Math.random().toString(36).slice(2)}`;
    svg("rect", { id: clip, ...display }, svg("clipPath", { id: clip }, svg("defs", {}, root)));
    svg("rect", { x: 40, y: 10, width: 220, height: 460, rx: 34, class: "ar-pose-face is-screen" }, root);
    const feed = svg("g", { "clip-path": `url(#${clip})` }, root);
    svg("rect", { ...display, class: "ar-pose-feed-wall" }, feed);
    svg("polygon", { points: `${horizon[0].join(",")} ${horizon[1].join(",")} ${display.x + display.width},${display.y + display.height} ${display.x},${display.y + display.height}`, class: "ar-pose-feed-floor" }, feed);
    this.drawFloorGrid(feed, floorY);
    this.drawCup(feed, cupBase[0], cupBase[1]);
    svg("rect", { x: cupBase[0] - 22, y: cupBase[1] - 36, width: 44, height: 42, class: "ar-pose-feed-focus" }, feed);
    svg("path", { d: `M${cx - 7},${cy}H${cx + 7}M${cx},${cy - 7}V${cy + 7}`, class: "ar-pose-crosshair" }, feed);
    svg("rect", { x: display.x, y: display.y + display.height - 70, width: display.width, height: 70, class: "ar-pose-feed-bar" }, feed);
    svg("circle", { cx, cy: display.y + display.height - 35, r: 20, class: "ar-pose-feed-shutter" }, feed);
    svg("circle", { cx, cy: display.y + display.height - 35, r: 15, class: "ar-pose-feed-shutter-inner" }, feed);
    svg("rect", { x: 115, y: 30, width: 70, height: 20, rx: 10, class: "ar-pose-island" }, root);
  }
}

const CUP_MODEL = { height: 0.1, base: 0.032, rim: 0.042 };
const CUP_START = { scale: [1, 1.5, 1], angles: { yaw: 0, pitch: 0, roll: 0 } };
const SCALE_HEADS = [
  { label: "width", cls: "is-c0" },
  { label: "height", cls: "is-c1" },
  { label: "depth", cls: "is-c2" },
  { label: "position", cls: "is-c3" },
];
const CUP_SIZES = [CUP_MODEL.rim * 2, CUP_MODEL.height, CUP_MODEL.rim * 2];

function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.reverse())];
}

class CupScaleExample extends CupExample {
  constructor(containerEl) {
    super(containerEl);
    this.viewYaw = -0.55;
    this.viewPitch = 0.32;
    this.frame = { w: W, h: H, scale: 1450, cx: W * 0.34, cy: H * 0.58, target: [0, 0.08, 0] };
    this.restart();
  }

  restart() {
    this.scale = CUP_START.scale.slice();
    this.cupAngles = { ...CUP_START.angles };
  }

  axes() {
    const { yaw, pitch, roll } = this.cupAngles;
    return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => rotY(rotX(rotZ(v, roll), pitch), yaw));
  }

  onload() {
    const root = html("div", "ar-pose", this.containerEl);
    const stage = html("div", "ar-pose-stage", root);
    this.svg = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "ar-pose-svg" }, stage);
    this.layer = svg("g", {}, this.svg);
    this.buildCupControls(stage);
    this.buildScaleMatrix(html("div", "ar-pose-panel", root));
    this.on(this.svg, "pointerdown", this.pointerDown);
    this.on(this.svg, "pointermove", this.pointerMove);
    this.on(this.svg, "pointerup", this.pointerUp);
    this.on(this.svg, "pointercancel", this.pointerUp);
    this.render();
  }

  buildCupControls(parent) {
    const box = html("div", "ar-pose-controls", parent);
    this.scaleSliders = SCALE_HEADS.slice(0, 3).map((h, i) =>
      this.slider(box, h.label, 0.5, 2.5, 0.05, (v) => {
        this.scale[i] = v;
        this.render();
      }),
    );
    this.angleSliders = ANGLES.map((a) =>
      this.slider(box, a.label, a.min, a.max, 1, (v) => {
        this.cupAngles[a.key] = v / DEG;
        this.render();
      }),
    );
    const reset = html("button", "", html("div", "ar-pose-presets", box), "reset");
    this.on(reset, "click", () => {
      this.restart();
      this.render();
    });
  }

  buildScaleMatrix(parent) {
    const grid = html("div", "ar-pose-matrix", parent);
    SCALE_HEADS.forEach((h) => html("div", `ar-pose-head ${h.cls}`, grid, h.label));
    html("div", "", grid);
    const rows = ["room x", "room y (up)", "room z", "w"];
    this.cells = [];
    for (let row = 0; row < 4; row++) {
      const cells = [];
      for (let col = 0; col < 4; col++) {
        const edge = col === 0 ? " is-left" : col === 3 ? " is-right" : "";
        const cell = html("div", `ar-pose-cell ${SCALE_HEADS[col].cls}${edge}`, grid);
        const key = col < 3 && row === col;
        cells.push(html("span", row === 3 ? "ar-pose-fixed" : `ar-pose-value${key ? " is-key" : ""}`, cell, row === 3 ? (col === 3 ? "1" : "0") : ""));
      }
      if (row < 3) this.cells.push(cells);
      html("div", `ar-pose-row${row === 3 ? " is-fixed" : ""}`, grid, rows[row]);
    }
  }

  cupGeometry(cols) {
    const { height, base, rim } = CUP_MODEL;
    const apply = (p) => add(add(mul(cols[0], p[0]), mul(cols[1], p[1])), mul(cols[2], p[2]));
    const ring = (y, r) => {
      const out = [];
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        out.push(apply([r * Math.cos(t), y, r * Math.sin(t)]));
      }
      return out;
    };
    const handle = [];
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI;
      const y = height * (0.48 + 0.27 * Math.sin(a));
      const wall = base + ((rim - base) * y) / height;
      handle.push(apply([-(wall + 0.022 * Math.cos(a)), y, 0]));
    }
    return { base: ring(0, base), rim: ring(height, rim), inner: ring(height, rim * 0.86), handle, top: apply([0, height, 0]) };
  }

  outline(points) {
    return hull(points.map((p) => this.project(p)).map((s) => [s[0], s[1]]));
  }

  polygon(points2d, cls) {
    return svg("polygon", { points: points2d.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), class: cls }, this.layer);
  }

  tag(at, dir, text, cls) {
    const a = this.project(at);
    const b = this.project(add(at, mul(dir, 0.01)));
    const d = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(d[0], d[1]) || 1;
    const u = [d[0] / l, d[1] / l];
    const anchor = Math.abs(u[0]) < 0.35 ? "middle" : u[0] > 0 ? "start" : "end";
    const t = svg("text", { x: a[0] + u[0] * 16, y: a[1] + u[1] * 16 + 4, class: `ar-pose-label ${cls}`, "text-anchor": anchor }, this.layer);
    t.textContent = text;
  }

  drawCupScene() {
    const { height } = CUP_MODEL;
    const axes = this.axes();
    const cols = axes.map((v, i) => mul(v, this.scale[i]));
    this.layer.replaceChildren();
    this.drawGrid([0, 0, 0], 0.15, 0);
    this.drawLocalAxes([0, 0, 0], 0.15);
    const model = this.cupGeometry(axes);
    const scaled = this.cupGeometry(cols);
    const handleBehind = this.view(sub(scaled.handle[12], scaled.top))[2] < 0;
    const drawHandle = () =>
      svg("polyline", { points: scaled.handle.map((p) => this.project(p).slice(0, 2).map((v) => v.toFixed(1)).join(",")).join(" "), class: "ar-pose-cup-handle is-3d" }, this.layer);
    if (handleBehind) drawHandle();
    this.polygon(this.outline([...scaled.base, ...scaled.rim]), "ar-pose-cup-body");
    this.polygon(scaled.rim.map((p) => this.project(p)), "ar-pose-cup-rim");
    this.polygon(scaled.inner.map((p) => this.project(p)), "ar-pose-cup-inside");
    if (!handleBehind) drawHandle();
    this.polygon(this.outline([...model.base, ...model.rim]), "ar-pose-cup-ghost");
    const ghostRim = this.project(model.rim[0]);
    const ghost = svg("text", { x: ghostRim[0] + 10, y: ghostRim[1] + 4, class: "ar-pose-dim" }, this.layer);
    ghost.textContent = "model at scale 1.00";
    const origin = [0, 0, 0];
    const reach = [CUP_MODEL.rim, height, CUP_MODEL.rim];
    cols.forEach((col, i) => {
      this.arrow(origin, col, reach[i], SCALE_HEADS[i].cls, "");
      const size = CUP_SIZES[i] * this.scale[i];
      const clear = i === 1 ? CUP_MODEL.rim * 0.6 : 0;
      this.tag(add(mul(col, reach[i]), mul(axes[i], clear)), axes[i], `col ${i} · ${SCALE_HEADS[i].label} ×${fmt(this.scale[i])} → ${fmt(size)} m`, SCALE_HEADS[i].cls);
    });
    const tick = this.project(model.top);
    svg("line", { x1: tick[0] - 6, y1: tick[1], x2: tick[0] + 6, y2: tick[1], class: "ar-pose-tick" }, this.layer);
    const base = this.project(origin);
    svg("circle", { cx: base[0], cy: base[1], r: 4, class: "ar-pose-tip is-c3" }, this.layer);
    return cols;
  }

  render() {
    const cols = this.drawCupScene();
    const values = [...cols, this.cup];
    this.cells.forEach((cells, row) => cells.forEach((cell, col) => (cell.textContent = fmt(values[col][row]))));
    this.scaleSliders.forEach((s, i) => {
      if (document.activeElement !== s.input) s.input.value = this.scale[i];
      s.value.textContent = `×${fmt(this.scale[i])}`;
    });
    this.angleSliders.forEach((s, i) => {
      const deg = Math.round(this.cupAngles[ANGLES[i].key] * DEG);
      if (document.activeElement !== s.input) s.input.value = deg;
      s.value.textContent = `${deg}°`;
    });
  }
}

function createView(source, container) {
  if (/example:\s*cup-scale/.test(source)) return new CupScaleExample(container);
  if (/example:\s*cup/.test(source)) return new CupExample(container);
  const match = /col:\s*([0-3])/.exec(source);
  return new PoseSim(container, match ? Number(match[1]) : undefined);
}

export function mountArPose(source, container) {
  container.replaceChildren();
  const view = createView(source, container);
  view.onload();
  return () => {
    view.onunload();
    container.replaceChildren();
  };
}
