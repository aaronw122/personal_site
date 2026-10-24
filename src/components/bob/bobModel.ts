// Loads the Meshy Bob Weir figurine and fixes it up on the raw vertices (the
// source mesh is one 1.1M-face shell with no skeleton):
//   1. bake the node transform, so geometry is in world space
//   2. delete the bobblehead stand
//   3. re-pose the raised left leg: procedural skin weights + two-bone IK,
//      with the guitar and everything above the waist held rigid
//   4. iron out the lump the old bent knee leaves on the straightened leg
//   5. cap the open sandal soles
//   6. cool the warm-cream hair and beard towards silver (shader)
//
// World frame: Y up, the figure faces +Z, about 1.8 tall, feet on GROUND_Y.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Top face of the stand; the sandals rest on it and it becomes the floor. */
export const GROUND_Y = -0.8495;

type Vec = [number, number, number];

// Joint estimates for the source pose (left knee raised, foot in the air).
const L_HIP: Vec = [0.07, -0.2, -0.03];
const L_KNEE: Vec = [0.09, -0.2, 0.22];
const L_ANKLE: Vec = [0.0, -0.555, 0.16];
const L_TOE: Vec = [0.03, -0.665, 0.3];
const R_HIP: Vec = [-0.06, -0.2, -0.04];
const R_KNEE: Vec = [-0.04, -0.48, -0.08];
const R_ANKLE: Vec = [-0.02, -0.76, -0.06];
const R_TOE: Vec = [-0.02, -0.83, 0.14];

// Segments that pull skin weight away from the left leg but never move.
const STATIC_SEGMENTS: [Vec, Vec][] = [
  [[-0.06, -0.15, -0.04], [0.05, -0.08, -0.03]], // pelvis
  [[0.0, -0.05, -0.03], [0.0, 0.6, -0.03]], // torso
  [R_HIP, R_KNEE],
  [R_KNEE, R_ANKLE],
  [R_ANKLE, R_TOE],
  [[-0.17, -0.1, 0.2], [0.07, 0.25, 0.22]], // guitar body to neck
];
const GUITAR = STATIC_SEGMENTS[5];

// Target pose: left foot planted beside and slightly ahead of the right.
const ANKLE_TARGET: Vec = [0.13, -0.765, 0.08];
const KNEE_POLE: Vec = [0.1, 0.0, 1.0]; // knee bends forward
const TOE_DIR: Vec = [0.1, -0.04, 0.24];

const SKIN_SIGMA = 0.012; // falloff of the distance-based skin weights
const LOCK_ABOVE_Y = -0.06; // nothing above the waist moves
// Guitar vertices stay rigid. Navy paint within this radius of the guitar axis
// seeds the mask, which then grows across connected navy or neutral (white
// bolt, black pickups) vertices so the whole instrument, including the lower
// horn that rested on the raised thigh, ignores the leg.
const GUITAR_RADIUS = 0.26;
const KNEE_SMOOTH = { inner: 0.05, outer: 0.09, iterations: 300 };
const SOLE_ZONE_Y = -0.7; // holes below this are sandal openings to cap
const HAIR_MIN_Y = 0.3; // hair recolouring only applies to the head

export interface BobStats {
  vertices: number;
  triangles: number;
  standTrianglesCut: number;
  movingVertices: number;
  guitarVertices: number;
  kneeSmoothed: number;
  holesCapped: number;
  footMinY: number;
  bbox: [Vec, Vec];
  ms: number;
}

const v3 = (p: Vec) => new THREE.Vector3(...p);

/** Distance from (x, y, z) to segment a-b; precomputes per segment. */
function segmentDistance(a: Vec, b: Vec) {
  const [ax, ay, az] = a;
  const dx = b[0] - ax, dy = b[1] - ay, dz = b[2] - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  return (x: number, y: number, z: number) => {
    const px = x - ax, py = y - ay, pz = z - az;
    const h = Math.min(Math.max((px * dx + py * dy + pz * dz) / len2, 0), 1);
    const qx = px - dx * h, qy = py - dy * h, qz = pz - dz * h;
    return Math.sqrt(qx * qx + qy * qy + qz * qz);
  };
}

/** Source geometry as plain float attributes in world space. */
function bakeGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = mesh.geometry.getAttribute(name);
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  geo.setIndex(mesh.geometry.index);
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

const NAVY = 1;
const NEUTRAL = 2;

/** Per-vertex paint class under the vertex: NAVY, NEUTRAL (white/grey/black) or 0. */
function paintClass(geo: THREE.BufferGeometry, map: THREE.Texture): Uint8Array {
  const img = map.image as CanvasImageSource & { width: number; height: number };
  const ctx = new OffscreenCanvas(img.width, img.height).getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, img.width, img.height).data;
  const uv = geo.getAttribute("uv").array as Float32Array;
  const n = uv.length / 2;
  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // glTF textures are not flipped: v = 0 is the top row
    const u = uv[i * 2] * map.repeat.x + map.offset.x;
    const v = uv[i * 2 + 1] * map.repeat.y + map.offset.y;
    const x = Math.min(Math.floor((u - Math.floor(u)) * img.width), img.width - 1);
    const y = Math.min(Math.floor((v - Math.floor(v)) * img.height), img.height - 1);
    const o = (y * img.width + x) * 4;
    const r = px[o], g = px[o + 1], b = px[o + 2];
    const hi = Math.max(r, g, b);
    // cream trousers sit around 0.2 saturation, so 0.12 keeps them out
    if (b > r + 15 && b > g + 5) cls[i] = NAVY;
    else if (hi - Math.min(r, g, b) < 0.12 * Math.max(hi, 1)) cls[i] = NEUTRAL;
  }
  return cls;
}

/** Guitar vertices: navy seeds near the axis, grown over navy/neutral neighbours. */
function guitarMask(pos: Float32Array, index: ArrayLike<number>, paint: Uint8Array): Uint8Array {
  const n = pos.length / 3;
  const dist = segmentDistance(...GUITAR);
  const near = new Uint8Array(n);
  for (let i = 0; i < n; i++) near[i] = dist(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) < GUITAR_RADIUS ? 1 : 0;
  // vertex -> neighbours (CSR), only between vertices near the guitar
  const deg = new Uint32Array(n + 1);
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) if (near[index[t + k]]) deg[index[t + k] + 1] += 2;
  }
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, n);
  const adj = new Uint32Array(deg[n]);
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = index[t + k];
      if (!near[a]) continue;
      adj[fill[a]++] = index[t + ((k + 1) % 3)];
      adj[fill[a]++] = index[t + ((k + 2) % 3)];
    }
  }
  const mask = new Uint8Array(n);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (near[i] && paint[i] === NAVY) {
      mask[i] = 1;
      queue.push(i);
    }
  }
  while (queue.length) {
    const a = queue.pop()!;
    for (let e = deg[a]; e < deg[a + 1]; e++) {
      const b = adj[e];
      if (!mask[b] && near[b] && paint[b] !== 0) {
        mask[b] = 1;
        queue.push(b);
      }
    }
  }
  return mask;
}

interface Bone {
  q: THREE.Quaternion;
  pivot: THREE.Vector3; // joint in the source pose
  dest: THREE.Vector3; // joint in the target pose
}

/** Two-bone IK for the left leg; the foot is aimed along TOE_DIR. */
function solveLeg(ankleTarget: THREE.Vector3): { bones: Bone[]; knee: THREE.Vector3; ankle: THREE.Vector3 } {
  const hip = v3(L_HIP), knee = v3(L_KNEE), ankle = v3(L_ANKLE), toe = v3(L_TOE);
  const l1 = knee.distanceTo(hip), l2 = ankle.distanceTo(knee);
  const axis = ankleTarget.clone().sub(hip);
  const d = Math.min(axis.length(), l1 + l2 - 1e-4);
  axis.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const r = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  const pole = v3(KNEE_POLE);
  pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const knee2 = hip.clone().addScaledVector(axis, x).addScaledVector(pole, r);
  const ankle2 = hip.clone().addScaledVector(axis, d);
  const dir = (a: THREE.Vector3, b: THREE.Vector3) => b.clone().sub(a).normalize();
  return {
    knee: knee2,
    ankle: ankle2,
    bones: [
      { q: new THREE.Quaternion().setFromUnitVectors(dir(hip, knee), dir(hip, knee2)), pivot: hip, dest: hip },
      { q: new THREE.Quaternion().setFromUnitVectors(dir(knee, ankle), dir(knee2, ankle2)), pivot: knee, dest: knee2 },
      { q: new THREE.Quaternion().setFromUnitVectors(dir(ankle, toe), v3(TOE_DIR).normalize()), pivot: ankle, dest: ankle2 },
    ],
  };
}

/** Linear-blend skinning of the moving vertices into `pos` / `nrm`. */
function applyLeg(
  bones: Bone[],
  weights: Float32Array,
  moving: Uint32Array,
  srcPos: Float32Array,
  srcNrm: Float32Array,
  pos: Float32Array,
  nrm: Float32Array,
) {
  const mats = bones.map(({ q, pivot, dest }) =>
    new THREE.Matrix4().makeTranslation(dest).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(pivot.clone().negate())),
  );
  const p = new THREE.Vector3(), nv = new THREE.Vector3(), accP = new THREE.Vector3(), accN = new THREE.Vector3();
  for (const i of moving) {
    p.fromArray(srcPos, i * 3);
    nv.fromArray(srcNrm, i * 3);
    let rest = 1;
    accP.set(0, 0, 0);
    accN.set(0, 0, 0);
    for (let b = 0; b < 3; b++) {
      const w = weights[i * 3 + b];
      if (w === 0) continue;
      rest -= w;
      accP.addScaledVector(p.clone().applyMatrix4(mats[b]), w);
      accN.addScaledVector(nv.clone().applyQuaternion(bones[b].q), w);
    }
    accP.addScaledVector(p, rest);
    accN.addScaledVector(nv, rest).normalize();
    accP.toArray(pos, i * 3);
    accN.toArray(nrm, i * 3);
  }
}

/** Closest point on the polyline a-b-c, its arc length, and the distance. */
function onLegAxis(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) {
  const seg = new THREE.Line3();
  const tmp = new THREE.Vector3();
  seg.set(a, b);
  const h1 = seg.closestPointToPointParameter(p, true);
  seg.at(h1, out);
  let s = h1 * a.distanceTo(b);
  let dist = out.distanceTo(p);
  seg.set(b, c);
  const h2 = seg.closestPointToPointParameter(p, true);
  seg.at(h2, tmp);
  if (tmp.distanceTo(p) < dist) {
    out.copy(tmp);
    s = a.distanceTo(b) + h2 * b.distanceTo(c);
    dist = tmp.distanceTo(p);
  }
  return { s, dist };
}

export async function loadBobModel(url: string, edit = true): Promise<THREE.Mesh> {
  const t0 = performance.now();
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  let src: THREE.Mesh | undefined;
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
  });
  if (!src) throw new Error(`no mesh in ${url}`);
  const material = src.material as THREE.MeshStandardMaterial;
  const geo = bakeGeometry(src);
  src.geometry.dispose();
  if (!edit) return new THREE.Mesh(geo, material);

  const srcPos = geo.getAttribute("position").array as Float32Array;
  const srcNrm = geo.getAttribute("normal").array as Float32Array;
  const uv = geo.getAttribute("uv").array as Float32Array;
  const index = geo.index!.array as Uint32Array;
  const n = srcPos.length / 3;

  // ---- skin weights for the left leg (thigh, shin, foot)
  const guitar = guitarMask(srcPos, index, paintClass(geo, material.map!));
  const segDist = [
    segmentDistance(L_HIP, L_KNEE),
    segmentDistance(L_KNEE, L_ANKLE),
    segmentDistance(L_ANKLE, L_TOE),
    ...STATIC_SEGMENTS.map(([a, b]) => segmentDistance(a, b)),
  ];
  const weights = new Float32Array(n * 3);
  const movingList: number[] = [];
  const d = new Float64Array(segDist.length);
  for (let i = 0; i < n; i++) {
    const x = srcPos[i * 3], y = srcPos[i * 3 + 1], z = srcPos[i * 3 + 2];
    if (guitar[i]) continue;
    // stand vertices are cut later; skinning them would skew the floor snap
    if (y > LOCK_ABOVE_Y || y < GROUND_Y) continue;
    let min = Infinity;
    for (let k = 0; k < d.length; k++) min = Math.min(min, (d[k] = segDist[k](x, y, z)));
    let sum = 0;
    for (let k = 0; k < d.length; k++) sum += d[k] = Math.exp(-(d[k] - min) / SKIN_SIGMA);
    const leg = (d[0] + d[1] + d[2]) / sum;
    if (leg < 1e-4) continue;
    for (let k = 0; k < 3; k++) weights[i * 3 + k] = d[k] / sum;
    movingList.push(i);
  }
  const moving = Uint32Array.from(movingList);

  // ---- pose the leg; re-aim the ankle until the sole sits on the floor
  const pos = srcPos.slice();
  const nrm = srcNrm.slice();
  const target = v3(ANKLE_TARGET);
  let leg = solveLeg(target);
  let footMinY = 0;
  // the last pass only measures, so the reported footMinY is the final pose
  for (let pass = 0; pass < 4; pass++) {
    leg = solveLeg(target);
    applyLeg(leg.bones, weights, moving, srcPos, srcNrm, pos, nrm);
    footMinY = Infinity;
    for (const i of moving) if (weights[i * 3 + 2] > 0.5) footMinY = Math.min(footMinY, pos[i * 3 + 1]);
    if (pass < 3) target.y += GROUND_Y - footMinY;
  }

  // ---- adjacency for the vertices we smooth or recompute normals for
  const hip = v3(L_HIP);
  const kneeS = hip.distanceTo(leg.knee);
  const axisPt = new THREE.Vector3(), p = new THREE.Vector3();
  const zone = new Int32Array(n).fill(-1);
  const zoneVerts: number[] = [];
  const zoneR: number[] = [];
  const zoneDir: THREE.Vector3[] = [];
  const zoneAxis: THREE.Vector3[] = [];
  const zoneFalloff: number[] = [];
  for (const i of moving) {
    if (weights[i * 3] + weights[i * 3 + 1] + weights[i * 3 + 2] < 0.5) continue;
    p.fromArray(pos, i * 3);
    const { s, dist } = onLegAxis(p, hip, leg.knee, leg.ankle, axisPt);
    const off = Math.abs(s - kneeS);
    if (off > KNEE_SMOOTH.outer) continue;
    zone[i] = zoneVerts.length;
    zoneVerts.push(i);
    zoneR.push(dist);
    zoneDir.push(p.clone().sub(axisPt).normalize());
    zoneAxis.push(axisPt.clone());
    zoneFalloff.push(1 - THREE.MathUtils.smoothstep(off, KNEE_SMOOTH.inner, KNEE_SMOOTH.outer));
  }
  const neighbours: number[][] = zoneVerts.map(() => []);
  for (let t = 0; t < index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const zi = zone[index[t + k]];
      if (zi < 0) continue;
      for (let j = 1; j < 3; j++) {
        const zj = zone[index[t + ((k + j) % 3)]];
        if (zj >= 0) neighbours[zi].push(zj);
      }
    }
  }

  // ---- knee: diffuse the radius about the leg axis (no shrinkage on a tube)
  let r = Float64Array.from(zoneR);
  let next = new Float64Array(r.length);
  for (let it = 0; it < KNEE_SMOOTH.iterations; it++) {
    for (let zi = 0; zi < r.length; zi++) {
      const nb = neighbours[zi];
      if (zoneFalloff[zi] === 0 || nb.length === 0) {
        next[zi] = r[zi];
        continue;
      }
      let s = 0;
      for (const zj of nb) s += r[zj];
      next[zi] = r[zi] + (s / nb.length - r[zi]) * zoneFalloff[zi];
    }
    [r, next] = [next, r];
  }
  for (let zi = 0; zi < zoneVerts.length; zi++) {
    const i = zoneVerts[zi];
    p.copy(zoneAxis[zi]).addScaledVector(zoneDir[zi], r[zi]).toArray(pos, i * 3);
  }

  // ---- cut the stand (by source position), keep the rest
  const tris: number[] = [];
  let standTrianglesCut = 0;
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (srcPos[a * 3 + 1] < GROUND_Y || srcPos[b * 3 + 1] < GROUND_Y || srcPos[c * 3 + 1] < GROUND_Y) {
      standTrianglesCut++;
      continue;
    }
    tris.push(a, b, c);
  }

  // ---- cap open loops around the soles. Edges are counted over every
  // triangle touching the zone, so counts are exact for zone edges.
  const inSole = (i: number) => pos[i * 3 + 1] < SOLE_ZONE_Y;
  const edgeCount = new Map<number, number>();
  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    if (!inSole(a) && !inSole(b) && !inSole(c)) continue;
    for (const [u, w] of [[a, b], [b, c], [c, a]]) edgeCount.set(key(u, w), (edgeCount.get(key(u, w)) ?? 0) + 1);
  }
  const nextOnRim = new Map<number, number[]>();
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      if (inSole(u) && inSole(w) && edgeCount.get(key(u, w)) === 1) {
        const list = nextOnRim.get(u);
        if (list) list.push(w);
        else nextOnRim.set(u, [w]);
      }
    }
  }
  const extraPos: number[] = [], extraNrm: number[] = [], extraUv: number[] = [];
  let holesCapped = 0;
  for (const start of nextOnRim.keys()) {
    // follow the directed rim edges round the hole
    const loop: number[] = [];
    let cur = start;
    while (nextOnRim.get(cur)?.length) {
      loop.push(cur);
      cur = nextOnRim.get(cur)!.pop()!;
      if (cur === start) break;
    }
    if (cur !== start || loop.length < 3) continue;
    const centre = new THREE.Vector3();
    for (const i of loop) centre.add(p.fromArray(pos, i * 3));
    centre.divideScalar(loop.length);
    // rim runs a->b on the surrounding faces, so the cap uses b->a
    const capNormal = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      e1.fromArray(pos, a * 3).sub(centre);
      e2.fromArray(pos, b * 3).sub(centre);
      capNormal.add(e1.clone().cross(e2).negate());
    }
    capNormal.normalize();
    const c = n + extraPos.length / 3;
    extraPos.push(centre.x, centre.y, centre.z);
    extraNrm.push(capNormal.x, capNormal.y, capNormal.z);
    extraUv.push(uv[loop[0] * 2], uv[loop[0] * 2 + 1]);
    for (let k = 0; k < loop.length; k++) tris.push(loop[(k + 1) % loop.length], loop[k], c);
    holesCapped++;
  }

  // ---- normals around the smoothed knee and on cap rims
  const faceN = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const fixN = new Float64Array(zoneVerts.length * 3);
  for (let t = 0; t < tris.length; t += 3) {
    const tri = [tris[t], tris[t + 1], tris[t + 2]];
    if (!tri.some((i) => i < n && zone[i] >= 0)) continue;
    const get = (i: number, out: THREE.Vector3) => (i < n ? out.fromArray(pos, i * 3) : out.fromArray(extraPos, (i - n) * 3));
    get(tri[0], pa);
    get(tri[1], pb);
    get(tri[2], pc);
    faceN.subVectors(pc, pb).cross(pa.clone().sub(pb)); // area-weighted
    for (const i of tri) {
      if (i >= n || zone[i] < 0) continue;
      const zi = zone[i];
      fixN[zi * 3] += faceN.x;
      fixN[zi * 3 + 1] += faceN.y;
      fixN[zi * 3 + 2] += faceN.z;
    }
  }
  for (let zi = 0; zi < zoneVerts.length; zi++) {
    p.set(fixN[zi * 3], fixN[zi * 3 + 1], fixN[zi * 3 + 2]).normalize().toArray(nrm, zoneVerts[zi] * 3);
  }

  // ---- compact: drop vertices only the stand used
  const total = n + extraPos.length / 3;
  const remap = new Int32Array(total).fill(-1);
  let used = 0;
  for (const i of tris) if (remap[i] < 0) remap[i] = used++;
  const outPos = new Float32Array(used * 3), outNrm = new Float32Array(used * 3), outUv = new Float32Array(used * 2);
  for (let i = 0; i < total; i++) {
    const j = remap[i];
    if (j < 0) continue;
    const [P, N, U, o] = i < n ? [pos, nrm, uv, i] : [extraPos, extraNrm, extraUv, i - n];
    outPos.set(P.slice(o * 3, o * 3 + 3), j * 3);
    outNrm.set(N.slice(o * 3, o * 3 + 3), j * 3);
    outUv.set(U.slice(o * 2, o * 2 + 2), j * 2);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(outNrm, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(outUv, 2));
  out.setIndex(new THREE.BufferAttribute(Uint32Array.from(tris, (i) => remap[i]), 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  geo.dispose();

  // The sole of the formerly raised foot has inward-facing patches.
  material.side = THREE.DoubleSide;
  coolHair(material);

  const mesh = new THREE.Mesh(out, material);
  const bb = out.boundingBox!;
  mesh.userData.stats = {
    vertices: used,
    triangles: tris.length / 3,
    standTrianglesCut,
    movingVertices: moving.length,
    guitarVertices: guitar.reduce((a, b) => a + b, 0),
    kneeSmoothed: zoneVerts.length,
    holesCapped,
    footMinY: +footMinY.toFixed(4),
    bbox: [bb.min.toArray().map((x) => +x.toFixed(3)) as Vec, bb.max.toArray().map((x) => +x.toFixed(3)) as Vec],
    ms: Math.round(performance.now() - t0),
  } satisfies BobStats;
  return mesh;
}

/** Meshy painted the hair and beard warm cream; Bob's is cool silver. */
function coolHair(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vBobY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBobY = position.y;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vBobY;").replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float hi = max(c.r, max(c.g, c.b));
        float sat = (hi - min(c.r, min(c.g, c.b))) / max(hi, 1e-4);
        // bright, low-saturation texels on the head: hair, beard, brows
        float k = step(${HAIR_MIN_Y.toFixed(2)}, vBobY) * (1.0 - smoothstep(0.3, 0.45, sat)) * smoothstep(0.08, 0.15, hi);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(c, vec3(l) * vec3(0.95, 0.99, 1.06), k);
      }`,
    );
  };
}
