#version 300 es
// Bob Weir bobblehead, raymarched as a signed distance field.
// World units: the figure stands ~2.0 tall on a pedestal at the origin,
// facing +z. Shading imitates a painted resin figurine: wrapped diffuse with
// a warm terminator on skin, soft shadows, AO, cool rim light and
// strand highlights on hair.
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uYaw;     // camera orbit around the figure
uniform vec2 uBobble;   // spring-driven head offset (pitch, roll), radians
uniform float uFocus;   // 0 full figure .. 1 head close-up

out vec4 fragColor;

#define MAT_SKIN 1.0
#define MAT_HAIR 2.0
#define MAT_BEARD 3.0
#define MAT_EYE 4.0
#define MAT_TANK 5.0
#define MAT_PANTS 6.0
#define MAT_SANDAL 7.0
#define MAT_GUITAR 8.0
#define MAT_NECK 9.0
#define MAT_METAL 10.0
#define MAT_BASE 11.0

// head local origin sits this far above the neck pivot (in head units)
#define HEAD_LIFT 0.285

// ---------------------------------------------------------------- utilities

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// keeps the material of whichever operand is closer
vec2 uni(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
vec2 suni(vec2 a, vec2 b, float k) { return vec2(smin(a.x, b.x, k), a.x < b.x ? a.y : b.y); }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// capsule whose radius goes from r1 at a to r2 at b
float sdTaper(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 1.7) + 0.125 * noise(p * 4.01 + 3.1);
}

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }

// ------------------------------------------------------------ pose (per frame)

vec3 gNeck;        // pivot the head bobbles around
mat3 gHeadRot;     // world -> head local
float gHeadScale;
vec3 gHeadCenter;  // world position of the head local origin
float gBlink;      // 0 open .. 1 closed

vec3 gGuitarPos;
mat3 gGuitarRot;   // world -> guitar local (x along the neck, z out of the top)

vec3 gShoulderR, gElbowR, gHandR;
vec3 gShoulderL, gElbowL, gHandL;

vec3 gKnee, gAnkle, gToe;  // crossed (left) leg

void setupPose(float t) {
  // head: turned to his right and cocked, idle sway plus the click spring
  float yaw = -0.3 + 0.05 * sin(t * 0.9);
  float pitch = 0.05 + 0.02 * sin(t * 4.5) + uBobble.x;
  float roll = 0.09 + 0.03 * sin(t * 2.25 + 1.0) + uBobble.y;
  gNeck = vec3(0.0, 1.3, 0.01);
  gHeadRot = rotZ(roll) * rotX(pitch) * rotY(yaw);
  gHeadScale = 1.42;
  gHeadCenter = gNeck + transpose(gHeadRot) * vec3(0.0, HEAD_LIFT * gHeadScale, 0.0);
  float bt = mod(t, 4.3);
  gBlink = smoothstep(0.0, 0.06, bt) * (1.0 - smoothstep(0.1, 0.18, bt));

  // guitar slung across the body, neck rising to his left
  gGuitarPos = vec3(0.01, 0.93, 0.175);
  mat3 toWorld = rotY(0.22) * rotX(-0.12) * rotZ(0.8);
  gGuitarRot = transpose(toWorld);

  // strumming hand travels across the strings over the pickups
  float strum = sin(t * 9.0);
  gShoulderR = vec3(-0.215, 1.215, -0.005);
  gHandR = gGuitarPos + toWorld * vec3(-0.02, 0.035 * strum, 0.085);
  gElbowR = vec3(-0.29, 0.985 + 0.012 * strum, 0.06);

  // fretting hand wrapped round the neck
  gShoulderL = vec3(0.215, 1.215, -0.005);
  gHandL = gGuitarPos + toWorld * vec3(0.36, -0.012, 0.0);
  gElbowL = vec3(0.265, 0.96, 0.07);

  // left leg crossed in front of the standing one, resting on its toes
  float tap = 0.012 * max(sin(t * 4.5), 0.0);
  gKnee = vec3(0.075, 0.5 + tap, 0.21);
  gAnkle = vec3(-0.1, 0.205 + tap, 0.085);
  gToe = vec3(-0.135, 0.105 + tap * 0.5, 0.16);
}

// ------------------------------------------------------------------- head

vec3 eyeCenter(float side) { return vec3(0.056 * side, 0.006, 0.118); }

// Head in local units (head centre at origin, face toward +z).
vec2 mapHead(vec3 q) {
  vec3 qx = vec3(abs(q.x), q.yz);

  // --- skull and long, weathered face
  float skin = sdEllipsoid(q - vec3(0.0, 0.05, -0.02), vec3(0.162, 0.19, 0.185));
  skin = smin(skin, sdEllipsoid(q - vec3(0.0, -0.08, 0.03), vec3(0.126, 0.16, 0.14)), 0.07);
  // cheekbones
  skin = smin(skin, sdEllipsoid(qx - vec3(0.083, -0.035, 0.098), vec3(0.058, 0.042, 0.05)), 0.04);
  // heavy brow ridge
  skin = smin(skin, sdEllipsoid(q - vec3(0.0, 0.04, 0.128), vec3(0.114, 0.032, 0.046)), 0.035);
  // deep-set eye sockets
  skin = smax(skin, -sdEllipsoid(qx - vec3(0.056, 0.004, 0.152), vec3(0.04, 0.027, 0.036)), 0.022);
  // bags under the eyes
  skin = smin(skin, sdEllipsoid(qx - vec3(0.058, -0.031, 0.141), vec3(0.035, 0.014, 0.018)), 0.016);
  // long nose with a bulb and flared nostrils
  skin = smin(skin, sdTaper(q, vec3(0.0, 0.025, 0.148), vec3(0.0, -0.06, 0.19), 0.016, 0.025), 0.02);
  skin = smin(skin, length(q - vec3(0.0, -0.068, 0.188)) - 0.028, 0.02);
  skin = smin(skin, length(qx - vec3(0.026, -0.078, 0.165)) - 0.02, 0.015);
  // ears, mostly buried in hair
  skin = smin(skin, sdEllipsoid(qx - vec3(0.16, -0.01, -0.005), vec3(0.02, 0.045, 0.03)), 0.02);
  // forehead furrows
  float fore = smoothstep(0.05, 0.08, q.y) * (1.0 - smoothstep(0.15, 0.18, q.y)) * smoothstep(0.08, 0.14, q.z);
  skin += fore * 0.0016 * sin(q.y * 150.0 + 0.6 * sin(q.x * 25.0));

  // eyes under heavy, squinting lids
  vec2 res = vec2(skin, MAT_SKIN);
  // upper lid edge in eye space: low enough to squint, high enough to show the iris
  float up = mix(0.008, -0.03, gBlink);
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    vec3 e = q - eyeCenter(side);
    res = uni(res, vec2(length(e) - 0.023, MAT_EYE));
    float lid = length(e) - 0.0295;
    // upper lid droops towards the outer corner
    float upper = max(lid, up - e.y - 0.12 * e.x * side);
    float lower = max(lid, e.y + 0.013);
    // lids are skin: suni keeps the closer operand's material
    res = suni(res, vec2(min(upper, lower), MAT_SKIN), 0.004);
  }

  // --- silver hair, swept back from a high hairline, falling to the jaw
  float hair = sdEllipsoid(q - vec3(0.0, 0.08, -0.05), vec3(0.182, 0.205, 0.2));
  hair = smin(hair, sdEllipsoid(q - vec3(0.0, -0.1, -0.11), vec3(0.19, 0.24, 0.12)), 0.1);
  hair = smin(hair, sdEllipsoid(qx - vec3(0.158, -0.08, -0.05), vec3(0.05, 0.17, 0.1)), 0.06);
  hair = smin(hair, sdEllipsoid(qx - vec3(0.168, -0.2, -0.075), vec3(0.055, 0.08, 0.08)), 0.05);
  float face = sdEllipsoid(q - vec3(0.0, -0.045, 0.17), vec3(0.158, 0.205, 0.165));
  hair = smax(hair, -face, 0.035);
  hair = smax(hair, -(q.y + 0.33), 0.04);
  if (hair < 0.03) {
    // strands run front-to-back over the top, back-and-down on the sides
    float w = smoothstep(0.09, 0.16, abs(q.x));
    float u = mix(q.x, 0.8 * q.y - 0.6 * q.z, w);
    float wob = fbm(q * 7.0);
    // fade strand relief out at the hairline; wide soft waves, little fine noise
    float wave = 0.5 + 0.5 * sin(u * 42.0 + wob * 4.0);
    hair += smoothstep(0.0, 0.04, face) * (0.008 * wave * wave
          + 0.0008 * (0.5 + 0.5 * sin(u * 220.0 + wob * 6.0)));
  }

  // --- full beard, drooping moustache, bushy brows
  float beard = sdEllipsoid(q - vec3(0.0, -0.152, 0.07), vec3(0.152, 0.13, 0.12));
  beard = smin(beard, sdEllipsoid(q - vec3(0.0, -0.24, 0.07), vec3(0.11, 0.095, 0.09)), 0.07);
  beard = smin(beard, sdEllipsoid(qx - vec3(0.142, -0.05, 0.012), vec3(0.036, 0.11, 0.065)), 0.05);
  beard = smax(beard, q.y - (-0.07 + 2.2 * q.x * q.x), 0.025);
  vec3 m = qx - vec3(0.038, -0.1, 0.168);
  m.xy = rot(-0.42) * m.xy;
  beard = smin(beard, sdEllipsoid(m, vec3(0.05, 0.018, 0.026)), 0.02);
  vec3 b = qx - vec3(0.058, 0.04, 0.153);
  b.xy = rot(0.18) * b.xy;
  float brows = sdEllipsoid(b, vec3(0.04, 0.009, 0.013));
  if (beard < 0.03) {
    // strands hang down; big soft clumps plus fine hair
    float u = q.x + 0.15 * q.z;
    float n = fbm(q * 12.0);
    beard += (n - 0.5) * 0.009
           + 0.004 * (0.5 + 0.5 * sin(u * 90.0 + n * 4.0))
           + 0.0014 * (0.5 + 0.5 * sin(u * 300.0 + n * 9.0));
  }
  if (brows < 0.02) brows += (fbm(q * 60.0) - 0.5) * 0.006;

  res = suni(res, vec2(hair, MAT_HAIR), 0.012);
  res = suni(res, vec2(beard, MAT_BEARD), 0.01);
  res = uni(res, vec2(brows, MAT_HAIR));
  return res;
}

// ------------------------------------------------------------------ guitar

float sdBody2D(vec2 p) {
  // offset double-cutaway body, longer upper horn
  float d = length(p - vec2(-0.06, 0.0)) - 0.118;
  d = smin(d, length(p - vec2(0.045, 0.058)) - 0.062, 0.06);
  d = smin(d, length(p - vec2(0.03, -0.062)) - 0.066, 0.06);
  d = smin(d, length(p - vec2(0.112, 0.072)) - 0.034, 0.045);
  d = smin(d, length(p - vec2(0.085, -0.075)) - 0.03, 0.04);
  d = smax(d, -(length(p - vec2(0.118, -0.008)) - 0.046), 0.02);
  return d;
}

// lightning-bolt pickguard, in body coordinates
float sdBolt(vec2 p) {
  vec2 v[7] = vec2[7](vec2(0.055, 0.052), vec2(-0.02, 0.012), vec2(0.012, 0.004),
                      vec2(-0.075, -0.06), vec2(-0.01, -0.012), vec2(-0.04, -0.006), vec2(0.02, 0.05));
  float d = dot(p - v[0], p - v[0]);
  float s = 1.0;
  for (int i = 0, j = 6; i < 7; j = i, i++) {
    vec2 e = v[j] - v[i], w = p - v[i];
    vec2 bb = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(bb, bb));
    bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}

vec2 mapGuitar(vec3 p) {
  vec3 g = gGuitarRot * (p - gGuitarPos);
  vec2 w = vec2(sdBody2D(g.xy), abs(g.z) - 0.02);
  float body = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.009;
  vec2 res = vec2(body, MAT_GUITAR);
  float neck = sdRoundBox(g - vec3(0.34, 0.0, 0.012), vec3(0.235, 0.019 - 0.004 * (g.x - 0.1), 0.01), 0.006);
  res = uni(res, vec2(neck, MAT_NECK));
  vec3 h = g - vec3(0.625, 0.008, 0.01);
  h.xy = rot(0.12) * h.xy;
  float head = sdRoundBox(h, vec3(0.055, 0.024 - 0.12 * max(h.x, 0.0), 0.006), 0.005);
  res = uni(res, vec2(head, MAT_GUITAR));
  vec3 tq = h - vec3(-0.01, 0.034, 0.0);
  tq.x = tq.x - 0.016 * clamp(floor(tq.x / 0.016 + 0.5), -2.0, 3.0);
  res = uni(res, vec2(length(tq) - 0.0065, MAT_METAL));
  return res;
}

// ------------------------------------------------------------------- body

// three straps across a foot running a -> b, plus a band round the ankle end
float sdStraps(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 pa = p - a, ba = b - a;
  float len = length(ba);
  float h = dot(pa, ba) / (len * len);
  float shell = abs(sdTaper(p, a, b, r1 + 0.004, r2 + 0.004)) - 0.004;
  float bands = (abs(fract(h * 2.6 + 0.2) - 0.5) - 0.16) * len / 2.6;
  return max(shell, max(bands, max(-h, h - 1.0)));
}

vec2 mapBody(vec3 p) {
  vec3 px = vec3(abs(p.x), p.yz);

  // torso core: the tank is an offset of this, so it never lets skin through
  float core = sdEllipsoid(p - vec3(0.0, 1.08, 0.0), vec3(0.19, 0.22, 0.12));
  core = smin(core, sdEllipsoid(p - vec3(0.0, 0.88, 0.01), vec3(0.168, 0.15, 0.118)), 0.08);
  float torso = smin(core, sdCapsule(p, vec3(-0.165, 1.225, -0.005), vec3(0.165, 1.225, -0.005), 0.064), 0.07);
  torso = smin(torso, sdCapsule(p, vec3(0.0, 1.2, 0.0), vec3(0.0, 1.36, 0.01), 0.058), 0.04);
  vec2 res = vec2(torso, MAT_SKIN);

  // loose sleeveless tank with deep armholes
  float tank = core - 0.013;
  tank = smin(tank, sdCapsule(p, vec3(-0.11, 1.25, -0.005), vec3(0.11, 1.25, -0.005), 0.062), 0.06);
  tank = smax(tank, -sdEllipsoid(px - vec3(0.228, 1.13, -0.01), vec3(0.07, 0.125, 0.085)), 0.015);
  tank = smax(tank, -sdEllipsoid(p - vec3(0.0, 1.31, 0.05), vec3(0.08, 0.07, 0.09)), 0.012);
  tank = smax(tank, 0.78 - p.y, 0.012);
  if (tank < 0.02) tank += (noise(p * vec3(9.0, 16.0, 9.0)) - 0.5) * 0.008;
  res = uni(res, vec2(tank, MAT_TANK));

  // arms and fists
  float arms = sdTaper(p, gShoulderR, gElbowR, 0.06, 0.046);
  arms = smin(arms, sdTaper(p, gElbowR, gHandR, 0.047, 0.034), 0.03);
  arms = smin(arms, sdTaper(p, gShoulderL, gElbowL, 0.06, 0.046), 0.06);
  arms = smin(arms, sdTaper(p, gElbowL, gHandL, 0.047, 0.034), 0.03);
  arms = smin(arms, sdEllipsoid(p - gHandR, vec3(0.038, 0.034, 0.032)), 0.02);
  arms = smin(arms, sdEllipsoid(p - gHandL, vec3(0.036, 0.04, 0.034)), 0.02);
  res = suni(res, vec2(arms, MAT_SKIN), 0.03);

  // baggy trousers: waist, standing right leg, crossed left leg
  float pants = sdEllipsoid(p - vec3(0.0, 0.76, 0.0), vec3(0.178, 0.12, 0.13));
  pants = smin(pants, sdTaper(p, vec3(-0.075, 0.72, 0.0), vec3(-0.065, 0.42, 0.02), 0.09, 0.074), 0.05);
  pants = smin(pants, sdTaper(p, vec3(-0.065, 0.42, 0.02), vec3(-0.055, 0.16, 0.0), 0.074, 0.06), 0.03);
  pants = smin(pants, sdTaper(p, vec3(0.075, 0.72, 0.0), gKnee, 0.094, 0.072), 0.06);
  pants = smin(pants, sdTaper(p, gKnee, gAnkle + normalize(gKnee - gAnkle) * 0.03, 0.072, 0.058), 0.03);
  pants = max(pants, p.y - 0.86);
  if (pants < 0.02) pants += (noise(p * vec3(11.0, 20.0, 11.0)) - 0.5) * 0.012;
  res = suni(res, vec2(pants, MAT_PANTS), 0.008);

  // bare feet
  vec3 heelR = vec3(-0.055, 0.12, -0.005), toeR = vec3(-0.055, 0.108, 0.1);
  float feet = sdTaper(p, heelR, toeR, 0.034, 0.029);
  feet = smin(feet, sdTaper(p, gAnkle, gToe, 0.034, 0.027), 0.02);
  res = suni(res, vec2(feet, MAT_SKIN), 0.02);

  // sandals: sole under the standing foot, straps over both
  float sole = sdRoundBox(p - vec3(-0.055, 0.089, 0.045), vec3(0.042, 0.006, 0.088), 0.006);
  float straps = sdStraps(p, heelR, toeR, 0.034, 0.029);
  straps = min(straps, sdStraps(p, gAnkle, gToe, 0.034, 0.027));
  res = uni(res, vec2(min(sole, straps), MAT_SANDAL));

  // pedestal
  res = uni(res, vec2(sdRoundBox(p - vec3(0.0, 0.04, 0.02), vec3(0.27, 0.035, 0.22), 0.012), MAT_BASE));
  return res;
}

// ------------------------------------------------------------------ scene

vec2 map(vec3 p) {
  vec2 res = mapBody(p);

  float hb = length(p - gHeadCenter) - 0.37 * gHeadScale;
  if (hb < 0.05) {
    vec3 q = gHeadRot * (p - gNeck) / gHeadScale - vec3(0.0, HEAD_LIFT, 0.0);
    vec2 h = mapHead(q);
    h.x *= gHeadScale;
    res = suni(res, h, 0.01);
  } else {
    res = uni(res, vec2(hb, MAT_HAIR));
  }

  float gb = length(p - gGuitarPos) - 0.75;
  res = uni(res, gb < 0.05 ? mapGuitar(p) : vec2(gb, MAT_GUITAR));
  return res;
}

vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1, -1);
  const float e = 0.0006;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.015;
  for (int i = 0; i < 40; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.01, 0.12);
    if (res < 0.005 || t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.06 * float(i);
    occ += (h - map(p + n * h).x) * sca;
    sca *= 0.8;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

// --------------------------------------------------------------- shading

vec3 shade(vec3 p, vec3 n, vec3 rd, float mat) {
  vec3 alb = vec3(0.8);
  float specAmt = 0.15, shin = 24.0, sss = 0.0, aniso = 0.0;
  vec3 strandT = vec3(0.0);
  vec3 q = gHeadRot * (p - gNeck) / gHeadScale - vec3(0.0, HEAD_LIFT, 0.0);

  if (mat == MAT_SKIN) {
    alb = vec3(0.78, 0.48, 0.32);
    // warmer cheeks and nose
    float flush = smoothstep(0.07, 0.0, length(vec3(abs(q.x), q.yz) - vec3(0.07, -0.05, 0.12)));
    flush += smoothstep(0.045, 0.0, length(q - vec3(0.0, -0.068, 0.19)));
    alb = mix(alb, vec3(0.82, 0.4, 0.3), 0.4 * clamp(flush, 0.0, 1.0));
    sss = 1.0; specAmt = 0.14; shin = 22.0;
  } else if (mat == MAT_HAIR) {
    float w = smoothstep(0.09, 0.16, abs(q.x));
    float u = mix(q.x, 0.8 * q.y - 0.6 * q.z, w);
    float g = 0.5 + 0.5 * sin(u * 260.0 + fbm(q * 7.0) * 6.0);
    float clump = 0.5 + 0.5 * sin(u * 42.0 + fbm(q * 7.0) * 4.0);
    alb = mix(vec3(0.4, 0.39, 0.38), vec3(0.8, 0.79, 0.77), 0.3 + 0.5 * clump * clump + 0.2 * g);
    vec3 dirLocal = normalize(mix(vec3(0.0, 0.0, -1.0), vec3(0.0, -0.6, -0.8), w));
    vec3 dW = transpose(gHeadRot) * dirLocal;
    strandT = normalize(dW - n * dot(n, dW));
    aniso = 0.35;
    specAmt = 0.0;
  } else if (mat == MAT_BEARD) {
    float u = q.x + 0.15 * q.z;
    float n2 = fbm(q * 12.0);
    float g = 0.5 + 0.5 * sin(u * 300.0 + n2 * 9.0);
    alb = mix(vec3(0.48, 0.47, 0.45), vec3(0.86, 0.85, 0.83), 0.35 + 0.4 * n2 + 0.25 * g);
    // darker where the moustache meets the beard
    alb *= 1.0 - 0.25 * smoothstep(0.04, 0.0, abs(q.y + 0.125)) * smoothstep(0.06, 0.0, abs(q.x));
    vec3 dW = transpose(gHeadRot) * vec3(0.0, -1.0, 0.0);
    strandT = normalize(dW - n * dot(n, dW));
    aniso = 0.12;
    specAmt = 0.0;
  } else if (mat == MAT_EYE) {
    float side = q.x < 0.0 ? -1.0 : 1.0;
    vec3 d = normalize(q - eyeCenter(side));
    vec3 look = normalize(vec3(-0.22, 0.06, 1.0));
    float c = dot(d, look);
    alb = vec3(0.74, 0.7, 0.64);
    alb = mix(alb, vec3(0.3, 0.42, 0.5), smoothstep(0.88, 0.9, c));
    alb = mix(alb, vec3(0.03), smoothstep(0.962, 0.972, c));
    specAmt = 0.9; shin = 120.0;
  } else if (mat == MAT_TANK) {
    alb = vec3(0.17, 0.18, 0.19);
    specAmt = 0.05; shin = 8.0;
  } else if (mat == MAT_PANTS) {
    alb = vec3(0.82, 0.77, 0.66);
    specAmt = 0.05; shin = 8.0;
  } else if (mat == MAT_SANDAL) {
    alb = vec3(0.46, 0.27, 0.14);
    specAmt = 0.3; shin = 40.0;
  } else if (mat == MAT_GUITAR) {
    vec3 g = gGuitarRot * (p - gGuitarPos);
    vec3 gn = gGuitarRot * n;
    alb = vec3(0.4, 0.5, 0.76);
    if (gn.z > 0.6 && g.x < 0.2) {
      if (sdBolt(g.xy) < 0.0) alb = vec3(0.93, 0.93, 0.9);
      float pu = min(sdRoundBox(vec3(g.xy - vec2(0.045, 0.0), 0.0), vec3(0.008, 0.026, 1.0), 0.003),
                     sdRoundBox(vec3(g.xy - vec2(-0.03, 0.0), 0.0), vec3(0.008, 0.026, 1.0), 0.003));
      pu = min(pu, sdRoundBox(vec3(g.xy - vec2(-0.075, 0.0), 0.0), vec3(0.006, 0.03, 1.0), 0.002));
      if (pu < 0.0) alb = vec3(0.08);
    }
    specAmt = 0.7; shin = 90.0;
  } else if (mat == MAT_NECK) {
    vec3 g = gGuitarRot * (p - gGuitarPos);
    alb = vec3(0.13, 0.1, 0.08);
    float fret = abs(fract((g.x - 0.11) / 0.03) - 0.5) * 0.03;
    if (fret < 0.0012 && g.z > 0.015) alb = vec3(0.75);
    if (g.z > 0.018 && abs(fract((g.y + 0.02) / 0.0075) - 0.5) < 0.12) alb = vec3(0.8);
    specAmt = 0.3; shin = 50.0;
  } else if (mat == MAT_METAL) {
    alb = vec3(0.75); specAmt = 1.0; shin = 120.0;
  } else if (mat == MAT_BASE) {
    alb = vec3(0.045); specAmt = 0.5; shin = 60.0;
  }

  vec3 key = normalize(vec3(-0.5, 0.8, 0.6));
  vec3 rim = normalize(vec3(0.75, 0.35, -0.6));
  vec3 v = -rd;
  float ndl = dot(n, key);
  float dif = clamp(ndl, 0.0, 1.0);
  float wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0);
  float sh = softShadow(p + n * 0.004, key);
  float ao = calcAO(p, n);

  vec3 col = vec3(0.0);
  // key light, wrapped on skin so the terminator goes warm instead of grey
  vec3 diffuse = mix(vec3(dif), vec3(wrap) * vec3(1.0, 0.7, 0.6) + vec3(dif) * vec3(0.0, 0.3, 0.4), sss);
  col += alb * diffuse * vec3(1.15, 1.08, 0.98) * mix(sh, 1.0, 0.1);
  // sky and ground bounce
  float sky = 0.5 + 0.5 * n.y;
  col += alb * mix(vec3(0.18, 0.14, 0.12), vec3(0.3, 0.33, 0.4), sky) * ao;
  // cool rim
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
  col += alb * vec3(0.5, 0.6, 0.8) * clamp(dot(n, rim), 0.0, 1.0) * 0.6 * ao;
  col += vec3(0.6, 0.7, 0.9) * fres * 0.08 * ao;
  // speculars
  vec3 hv = normalize(key + v);
  col += specAmt * pow(clamp(dot(n, hv), 0.0, 1.0), shin) * (0.6 + 0.6 * fres) * sh * vec3(1.0, 0.97, 0.9);
  if (aniso > 0.0) {
    float th = dot(strandT, hv);
    col += aniso * pow(sqrt(max(1.0 - th * th, 0.0)), 70.0) * sh * vec3(1.0, 0.97, 0.92);
  }
  return col;
}

// ------------------------------------------------------------------- main

void main() {
  setupPose(uTime);

  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 target = mix(vec3(0.0, 1.12, 0.0), gHeadCenter + vec3(0.0, -0.02, 0.0), uFocus);
  float dist = mix(4.5, 2.3, uFocus);
  vec3 ro = target + vec3(sin(uYaw) * dist, mix(0.35, 0.05, uFocus), cos(uYaw) * dist);
  vec3 cw = normalize(target - ro);
  vec3 cu = normalize(cross(cw, vec3(0, 1, 0)));
  vec3 cv = cross(cu, cw);
  vec3 rd = normalize(uv.x * cu + uv.y * cv + 1.9 * cw);
  float pix = 1.0 / (uRes.y * 1.9);

  // only march inside a cylinder around the figure
  vec2 oc = ro.xz, dd = rd.xz;
  float b = dot(oc, dd), c = dot(oc, oc) - 0.62 * 0.62, a = dot(dd, dd);
  float disc = b * b - a * c;
  if (disc < 0.0) { fragColor = vec4(0.0); return; }
  float t = max((-b - sqrt(disc)) / a, 0.0);
  float tMax = (-b + sqrt(disc)) / a;

  // march, remembering the closest grazing approach for antialiased edges
  float bestRatio = 1e9, bestT = t, mat = 0.0;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t;
    if (p.y < -0.02 || p.y > 2.2 && rd.y > 0.0) break;
    vec2 h = map(p);
    float ratio = h.x / t;
    if (ratio < bestRatio) { bestRatio = ratio; bestT = t; mat = h.y; }
    if (h.x < 0.0004 * t) { hit = true; break; }
    t += h.x * 0.75;
    if (t > tMax) break;
  }

  float alpha = hit ? 1.0 : 1.0 - smoothstep(0.0, 1.5 * pix, bestRatio);
  if (alpha <= 0.0) { fragColor = vec4(0.0); return; }

  vec3 p = ro + rd * bestT;
  vec3 n = calcNormal(p);
  vec3 col = shade(p, n, rd, mat);

  // filmic tone map and gamma
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  fragColor = vec4(col * alpha, alpha);
}
