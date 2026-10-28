// @ts-nocheck
// Adapted from the Obsidian uwb-device-pulse plugin.
class MarkdownRenderChild {
  constructor(containerEl) { this.containerEl = containerEl; }
}

/*
 * ```uwb-pulse
 * ```
 *
 * Port of devicePulseSim() from uwb.tldraw (script/main.js, "recurse tech talk", slide 2):
 * device 1 fires a pulse, device 2 takes it in. Same wave packet, timeline, easing and
 * colors; drawn in the slide's page coordinates and looped only while on screen.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// slide-2 geometry (page units inside the 1920x1080 slide frame)
const DEV_W = 340;
const DEV_H = 240;
const DEV1 = { x: 200, y: 600, label: "device 1" };
const DEV2 = { x: 1380, y: 600, label: "device 2" };
const VIEW = { x: 150, y: 540, w: 1620, h: 360 };

const N = 80;
const PACKET_W = 260;
const AMP = 70;
const CYCLES = 6;
// timeline (ms): emit flash, travel, receive flash, rest
const EMIT = 300;
const TRAVEL = 1800;
const RECEIVE = 700;
const LOOP = EMIT + TRAVEL + RECEIVE + 700;

// gaussian-enveloped wiggle, x centered on 0; shape is fixed, only position animates
const WAVE_PATH = (() => {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1) - 0.5;
    const env = Math.exp(-0.5 * Math.pow(u / 0.17, 2));
    pts.push(`${(u * PACKET_W).toFixed(2)},${(-AMP * env * Math.sin(2 * Math.PI * CYCLES * u)).toFixed(2)}`);
  }
  return "M" + pts.join(" L");
})();

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function svg(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

class DevicePulseSim extends MarkdownRenderChild {
  constructor(containerEl) {
    super(containerEl);
    this.t = 0;
    this.last = null;
    this.frame = 0;
    this.visible = false;
    this.lastColors = "";
  }

  onload() {
    const root = this.containerEl.appendChild(Object.assign(document.createElement("div"), { className: "uwb-device-pulse" }));
    const s = svg("svg", {
      viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`,
      class: "uwb-device-pulse-svg",
      role: "img",
      "aria-label": "device 1 emits a UWB pulse that travels to device 2",
    }, root);

    // pulse first so it hides behind the boxes at both ends
    this.pulse = svg("path", {
      d: WAVE_PATH,
      class: "uwb-device-pulse-wave",
      "stroke-width": 3.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }, s);
    this.dev1 = this.device(s, DEV1);
    this.dev2 = this.device(s, DEV2);

    this.a = { x: DEV1.x + DEV_W / 2, y: DEV1.y + DEV_H / 2 };
    this.b = { x: DEV2.x + DEV_W / 2, y: DEV2.y + DEV_H / 2 };
    this.render();

    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.frame) {
        this.last = null;
        this.frame = requestAnimationFrame(this.tick);
      }
    });
    this.observer.observe(root);
  }

  onunload() {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  // colors live in styles.css (tldraw light/dark palettes keyed off body.theme-dark)
  device(parent, { x, y, label }) {
    const g = svg("g", { class: "uwb-device-pulse-device", "data-color": "black" }, parent);
    svg("rect", {
      x, y, width: DEV_W, height: DEV_H, rx: 8,
      "stroke-width": 3.5,
    }, g);
    const text = svg("text", {
      x: x + DEV_W / 2, y: y + DEV_H / 2,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      class: "uwb-device-pulse-label",
    }, g);
    text.textContent = label;
    return g;
  }

  paint(device, color) {
    device.setAttribute("data-color", color);
  }

  tick = (now) => {
    if (!this.visible) {
      this.frame = 0;
      return;
    }
    const elapsed = this.last === null ? 0 : Math.min(100, now - this.last);
    this.last = now;
    this.t = (this.t + elapsed) % LOOP;
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };

  render() {
    const { t, a, b } = this;
    const p = Math.min(1, Math.max(0, (t - EMIT) / TRAVEL));
    const x = a.x + (b.x - a.x) * ease(p);
    const y = a.y + (b.y - a.y) * ease(p);
    const c1 = t < EMIT ? "blue" : "black";
    const c2 = t >= EMIT + TRAVEL && t < EMIT + TRAVEL + RECEIVE ? "green" : "black";

    this.pulse.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const colors = c1 + c2;
    if (colors !== this.lastColors) {
      this.lastColors = colors;
      this.paint(this.dev1, c1);
      this.paint(this.dev2, c2);
    }
  }
}

export function mountUwbPulse(container) {
  container.replaceChildren();
  const view = new DevicePulseSim(container);
  view.onload();
  return () => {
    view.onunload();
    container.replaceChildren();
  };
}
