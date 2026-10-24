// Hand-built 3D Bob Weir bobblehead: one full-screen fragment shader raymarches
// the figure (see bob.frag.glsl). Drag to spin him, click to bobble his head.
import { useEffect, useRef } from "react";
import fragSource from "./bob.frag.glsl?raw";

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const DEFAULT_YAW = 0.3;
// head spring: low damping so a click makes it wobble for a second or two
const SPRING_K = 70;
const SPRING_DAMP = 3.2;

interface Props {
  width?: number;
  height?: number;
  /** Freeze animation at this time in seconds (for stills and debugging). */
  freezeAt?: number;
  initialYaw?: number;
  /** 0 frames the whole figure, 1 is a close-up of the head. */
  focus?: number;
}

export default function BobRaymarch({ width = 360, height = 600, freezeAt, initialYaw = DEFAULT_YAW, focus = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uYaw = gl.getUniformLocation(prog, "uYaw");
    const uBobble = gl.getUniformLocation(prog, "uBobble");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, "uFocus"), focus);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let yaw = initialYaw;
    let yawVel = 0;
    // head spring state: [pitch, roll] offset and velocity
    const bob = [0, 0];
    const bobVel = [0, 0];
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = 0;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragMoved += Math.abs(dx);
      yaw -= dx * 0.01;
      yawVel = -dx * 0.01;
    };
    const onUp = () => {
      dragging = false;
      if (dragMoved < 4) {
        // a click: knock the head
        bobVel[0] += 2.6 * (Math.random() < 0.5 ? -1 : 1);
        bobVel[1] += 3.4 * (Math.random() < 0.5 ? -1 : 1);
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    let raf = 0;
    let visible = true;
    let last = performance.now();
    const start = last;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      if (!dragging) {
        yaw += yawVel;
        yawVel *= 0.92;
      }
      for (let i = 0; i < 2; i++) {
        bobVel[i] += (-SPRING_K * bob[i] - SPRING_DAMP * bobVel[i]) * dt;
        bob[i] += bobVel[i] * dt;
      }
      const t = freezeAt ?? (reduceMotion ? 0 : (now - start) / 1000);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uYaw, yaw);
      gl.uniform2f(uBobble, bob[0], bob[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible) raf = requestAnimationFrame(frame);
    };

    // stop rendering while off screen
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [width, height, freezeAt, initialYaw, focus]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: "grab", touchAction: "none" }}
      aria-label="3D Bob Weir bobblehead. Drag to spin, click to bobble"
      role="img"
    />
  );
}
