#version 300 es
// Bob Weir bobblehead, raymarched as a signed distance field.
// World units: the figure stands ~2.1 tall on a square pedestal at the
// origin, facing +z. Shading imitates a painted resin collectible: wrapped
// diffuse with a warm terminator on skin, penumbra soft shadows, AO, a front
// fill, a cool rim and anisotropic strand highlights on hair.
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uYaw;     // camera orbit around the figure
uniform vec2 uBobble;   // spring-driven head offset (pitch, roll), radians
uniform float uFocus;   // 0 full figure .. 1 head close-up
uniform int uAA;        // samples per pixel axis: 1 or 2

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
#define MAT_GUARD 12.0
#define MAT_PICKUP 13.0
#define MAT_BROW 14.0
#define MAT_STRAP 15.0
// bounding-sphere stand-in for a sub-model that is far away: never shaded,
// and skipped by shadow rays (treating it as an occluder caused contour bands)
#define MAT_PROXY -1.0

// head local origin sits this far above the neck pivot (in head units);
// leaves a little visible neck between beard and tank
#define HEAD_LIFT 0.31
// the upper body is authored 0.06 higher than it sits, shortening the legs
#define DROP 0.06
#define GUITAR_SCALE 1.08

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
mat3 gGuitarToWorld;

// palms in guitar-local coords; wrists/elbows/shoulders in world coords
vec3 gPalmR, gPalmL;
vec3 gShoulderR, gElbowR, gWristR;
vec3 gShoulderL, gElbowL, gWristL;

vec3 gKnee, gAnkle, gToe;  // crossed (left) leg

void setupPose(float t) {
  // head: turned to his right and cocked, idle sway plus the click spring
  float yaw = -0.3 + 0.05 * sin(t * 0.9);
  float pitch = 0.05 + 0.02 * sin(t * 4.5) + uBobble.x;
  float roll = 0.09 + 0.03 * sin(t * 2.25 + 1.0) + uBobble.y;
  gNeck = vec3(0.0, 1.3 - DROP, 0.01);
  gHeadRot = rotZ(roll) * rotX(pitch) * rotY(yaw);
  gHeadScale = 1.6;
  gHeadCenter = gNeck + transpose(gHeadRot) * vec3(0.0, HEAD_LIFT * gHeadScale, 0.0);
  float bt = mod(t, 4.3);
  gBlink = smoothstep(0.0, 0.06, bt) * (1.0 - smoothstep(0.1, 0.18, bt));

  // guitar slung across the body, neck rising to his left, clear of the beard
  gGuitarPos = vec3(0.01, 0.93 - DROP, 0.19);
  gGuitarToWorld = rotY(0.22) * rotX(-0.12) * rotZ(0.66);
  gGuitarRot = transpose(gGuitarToWorld);

  // strumming hand travels across the strings over the pickups
  float strum = 0.035 * sin(t * 9.0);
  gPalmR = vec3(-0.02, strum, 0.058);
  gShoulderR = vec3(-0.215, 1.215 - DROP, -0.005);
  gElbowR = vec3(-0.3, 1.0 - DROP + 0.3 * strum, 0.1);
  vec3 palmR = gGuitarPos + gGuitarToWorld * gPalmR;
  gWristR = palmR + normalize(gElbowR - palmR) * 0.034;

  // fretting hand wrapped round the neck
  gPalmL = vec3(0.36, -0.042, 0.0);
  gShoulderL = vec3(0.215, 1.215 - DROP, -0.005);
  gElbowL = vec3(0.3, 1.02 - DROP, 0.11);
  vec3 palmL = gGuitarPos + gGuitarToWorld * gPalmL;
  gWristL = palmL + normalize(gElbowL - palmL) * 0.03;

  // left leg crossed clearly in front of the standing one, resting on its toes
  float tap = 0.012 * max(sin(t * 4.5), 0.0);
  gKnee = vec3(0.135, 0.47 + tap, 0.215);
  gAnkle = vec3(-0.155, 0.18 + tap, 0.135);
  gToe = vec3(-0.185, 0.122 + tap * 0.5, 0.225);
}

// ------------------------------------------------------------------- head

vec3 eyeCenter(float side) { return vec3(0.056 * side, 0.006, 0.118); }

// mouth crease: one corner raised for a wry look; cut into skin and beard
float sdMouth(vec3 q) {
  return sdCapsule(q, vec3(-0.035, -0.134, 0.171), vec3(0.032, -0.125, 0.174), 0.004);
}

// Head in local units (head centre at origin, face toward +z).
vec2 mapHead(vec3 q) {
  vec3 qx = vec3(abs(q.x), q.yz);

  // --- narrow skull and long, weathered face
  float skin = sdEllipsoid(q - vec3(0.0, 0.058, -0.022), vec3(0.148, 0.198, 0.179));
  skin = smin(skin, sdEllipsoid(q - vec3(0.0, -0.09, 0.034), vec3(0.104, 0.17, 0.132)), 0.045);
  // narrow, projected cheekbones
  skin = smin(skin, sdEllipsoid(qx - vec3(0.073, -0.036, 0.112), vec3(0.039, 0.028, 0.031)), 0.019);
  // prominent brow ridge over deep-set sockets
  skin = smin(skin, sdEllipsoid(q - vec3(0.0, 0.045, 0.132), vec3(0.101, 0.021, 0.034)), 0.018);
  skin = smax(skin, -sdEllipsoid(qx - vec3(0.055, 0.008, 0.154), vec3(0.041, 0.024, 0.037)), 0.012);
  // bags under the eyes
  skin = smin(skin, sdEllipsoid(qx - vec3(0.058, -0.031, 0.141), vec3(0.035, 0.014, 0.018)), 0.016);
  // long, straight nose with a restrained tip
  skin = smin(skin, sdTaper(q, vec3(0.0, 0.04, 0.151), vec3(0.0, -0.081, 0.198), 0.013, 0.014), 0.011);
  skin = smin(skin, length(q - vec3(0.0, -0.085, 0.198)) - 0.0135, 0.008);
  skin = smin(skin, length(qx - vec3(0.017, -0.089, 0.181)) - 0.0085, 0.006);
  // ears, mostly buried in hair
  skin = smin(skin, sdEllipsoid(qx - vec3(0.148, -0.012, -0.004), vec3(0.018, 0.043, 0.027)), 0.015);
  // two forehead creases and crow's feet, cut shallow into the surface
  float lines = sdCapsule(q, vec3(-0.07, 0.078, 0.162), vec3(0.07, 0.078, 0.162), 0.0022);
  lines = min(lines, sdCapsule(q, vec3(-0.058, 0.1, 0.157), vec3(0.058, 0.1, 0.157), 0.002));
  for (int i = 0; i < 3; i++) {
    float fi = float(i) - 1.0;
    lines = min(lines, sdCapsule(qx, vec3(0.088, 0.004 + fi * 0.008, 0.125),
                                     vec3(0.108, 0.006 + fi * 0.016, 0.109), 0.0017));
  }
  skin = smax(skin, -lines, 0.003);
  skin = smax(skin, -sdMouth(q), 0.0025);

  // eyes under heavy, squinting lids, slightly asymmetric
  vec2 res = vec2(skin, MAT_SKIN);
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    // mild asymmetric squint that still shows the iris at web scale
    float up = mix(side < 0.0 ? 0.008 : 0.01, -0.03, gBlink);
    vec3 e = q - eyeCenter(side);
    res = uni(res, vec2(length(e) - 0.0225, MAT_EYE));
    float lid = length(e) - 0.0275;
    // upper lid droops towards the outer corner
    float upper = max(lid, up - e.y - 0.085 * e.x * side);
    float lower = max(lid, e.y + 0.012);
    // lids are skin: suni keeps the closer operand's material
    res = suni(res, vec2(min(upper, lower), MAT_SKIN), 0.004);
  }

  // --- silver hair: a shell offset from the skull (so it always covers it),
  // grown into a swept-back mass, with shallow lock grooves.
  // outside its bound the hair is at least this far away (all hair lies within 0.39)
  float hairBound = length(q - vec3(0.0, -0.055, -0.075));
  float hair = hairBound - 0.39;
  if (hairBound < 0.415) {
    float skull = sdEllipsoid(q - vec3(0.0, 0.058, -0.022), vec3(0.148, 0.198, 0.179));
    hair = skull - 0.016;
    // lift over the crown, set back
    hair = smin(hair, sdEllipsoid(q - vec3(0.0, 0.19, -0.075), vec3(0.14, 0.1, 0.165)), 0.035);
    // mass behind the skull down to the nape
    hair = smin(hair, sdEllipsoid(q - vec3(0.0, -0.06, -0.116), vec3(0.15, 0.205, 0.105)), 0.032);
    // side curtains taper and lean back rather than hanging as walls
    hair = smin(hair, sdTaper(qx, vec3(0.125, 0.035, -0.055), vec3(0.145, -0.265, -0.078), 0.052, 0.027), 0.02);
    // irregular terminal locks; small blends keep separate tips
    hair = smin(hair, sdTaper(q, vec3(-0.125, -0.205, -0.08), vec3(-0.139, -0.302, -0.092), 0.04, 0.02), 0.014);
    hair = smin(hair, sdTaper(q, vec3(-0.065, -0.225, -0.112), vec3(-0.078, -0.325, -0.125), 0.043, 0.019), 0.014);
    hair = smin(hair, sdTaper(q, vec3(0.0, -0.23, -0.128), vec3(0.01, -0.337, -0.143), 0.044, 0.018), 0.014);
    hair = smin(hair, sdTaper(q, vec3(0.064, -0.22, -0.11), vec3(0.082, -0.318, -0.118), 0.042, 0.019), 0.014);
    hair = smin(hair, sdTaper(q, vec3(0.123, -0.2, -0.076), vec3(0.143, -0.292, -0.064), 0.038, 0.019), 0.014);
    // high forehead, receding temples: thin the hair onto the scalp before
    // removing it, so there is no full-thickness lip at the hairline. At its
    // thinnest the hair is still 0.002 outside the skull.
    float foreheadCut = sdEllipsoid(q - vec3(0.0, -0.054, 0.166), vec3(0.13, 0.176, 0.141));
    float templeCut = sdEllipsoid(qx - vec3(0.108, 0.045, 0.13), vec3(0.052, 0.104, 0.101));
    float hairEdge = min(foreheadCut, templeCut);
    float hairFade = smoothstep(-0.018, 0.025, hairEdge);
    hair += 0.014 * (1.0 - hairFade);
    hair = smax(hair, -(hairEdge + 0.018), 0.012);
    // lock grooves fanning back from a parting point in front of the forehead:
    // its pole sits outside the hair (an axis-centred angle pinched the crown)
    float partRadius = length(vec2(q.x, q.z - 0.24));
    float u = atan(q.x, 0.24 - q.z);
    float phase = u + 0.09 * q.y + 0.045 * sin(3.7 * u + q.y * 11.0);
    float broadGroove = smoothstep(0.58, 1.0, cos(phase * 24.0 + 0.35 * sin(phase * 4.0)));
    float fineGroove = smoothstep(0.68, 1.0, cos(phase * 55.0 + q.y * 7.0 + 1.1));
    hair += (0.003 * broadGroove + 0.0012 * fineGroove) * smoothstep(0.055, 0.11, partRadius) * hairFade;
  }

  // --- full beard: a shell offset from the lower face (so skin never pokes
  // through), soft clumps, shallow strand grooves
  // outside its bound the beard is at least this far away (all beard lies within 0.285)
  float beardBound = length(q - vec3(0.0, -0.185, 0.075));
  float beard = beardBound - 0.285;
  if (beardBound < 0.305) {
    float lowerFace = sdEllipsoid(q - vec3(0.0, -0.09, 0.034), vec3(0.104, 0.17, 0.132));
    beard = lowerFace - 0.016;
    beard = smin(beard, sdEllipsoid(q - vec3(0.0, -0.17, 0.085), vec3(0.112, 0.11, 0.085)), 0.03);
    beard = smin(beard, sdEllipsoid(q - vec3(0.0, -0.235, 0.08), vec3(0.08, 0.07, 0.065)), 0.03);
    // sideburns down to the jaw
    beard = smin(beard, sdEllipsoid(qx - vec3(0.122, -0.068, 0.03), vec3(0.03, 0.087, 0.05)), 0.027);
    // growth line across the cheeks
    beard = smax(beard, q.y - (-0.076 + 1.7 * q.x * q.x), 0.019);
    // six overlapping, irregular soft clumps (unioned with the face shell)
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float rnd = fract(sin((fi + 1.0) * 12.9898) * 43758.5453);
      float x0 = (fi - 2.5) * 0.031 + (rnd - 0.5) * 0.009;
      float sd = abs(fi - 2.5) / 2.5;
      vec3 a = vec3(x0, -0.145 - 0.01 * rnd, 0.148 - 0.012 * sd);
      vec3 c = vec3(x0 + (rnd - 0.5) * 0.015, -0.225 + 0.012 * sd, 0.132 - 0.018 * sd);
      vec3 b = vec3(x0 * 0.72 + (rnd - 0.5) * 0.018, -0.302 + 0.025 * sd + 0.008 * rnd, 0.105 - 0.02 * sd);
      float clump = sdTaper(q, a, c, 0.031, 0.025);
      clump = smin(clump, sdTaper(q, c, b, 0.025, 0.015), 0.012);
      beard = smin(beard, clump, 0.017);
    }
    // irregular channels between clumps: narrower and more twisted towards
    // the tips, each with its own depth; max() keeps overlaps shallow
    float down = clamp((-q.y - 0.13) / 0.17, 0.0, 1.0);
    float bgr = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float rnd = fract(sin((fi + 3.0) * 17.173) * 41317.31);
      float center = (fi - 3.0) * 0.027 + (rnd - 0.5) * 0.01;
      center += mix(0.002, 0.011, down) * sin(q.y * (15.0 + 4.0 * rnd) + fi * 1.71);
      float width = mix(0.01, 0.0045, down);
      float x = (q.x - center) / width;
      bgr = max(bgr, (0.0014 + 0.0023 * rnd) * exp(-x * x));
    }
    beard += bgr * (1.0 - smoothstep(-0.13, -0.105, q.y)) * (1.0 - smoothstep(0.285, 0.315, -q.y));
    // full moustache rooted under the nose, drooping and tapering outward
    vec3 ma = vec3(0.006, -0.103, 0.184);
    vec3 mb = vec3(0.039, -0.113, 0.181);
    vec3 mc = vec3(0.079, -0.142, 0.158);
    float moustache = sdTaper(qx, ma, mb, 0.018, 0.016);
    moustache = smin(moustache, sdTaper(qx, mb, mc, 0.016, 0.009), 0.01);
    moustache = smin(moustache, sdEllipsoid(q - vec3(0.0, -0.106, 0.179), vec3(0.027, 0.014, 0.019)), 0.009);
    moustache = smin(moustache, sdTaper(qx, vec3(0.031, -0.119, 0.177), vec3(0.069, -0.147, 0.158), 0.01, 0.006), 0.007);
    beard = smin(beard, moustache, 0.012);
    beard = smax(beard, -sdMouth(q), 0.0025);
  }

  // bushy grey brows sitting close to the skin, inner ends lower
  float brows = 1e9;
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec3 b0 = vec3(side * 0.025, 0.029, 0.164);
    vec3 b1 = vec3(side * 0.051, 0.039, 0.161);
    vec3 b2 = vec3(side * 0.077, 0.04, 0.154);
    vec3 b3 = vec3(side * 0.096, 0.033, 0.145);
    float d = sdTaper(q, b0, b1, 0.0046, 0.0054);
    d = smin(d, sdTaper(q, b1, b2, 0.0054, 0.0048), 0.005);
    d = smin(d, sdTaper(q, b2, b3, 0.0048, 0.0037), 0.005);
    brows = min(brows, d);
  }

  // outside their bounds hair/beard distances are stand-ins, not occluders
  res = suni(res, vec2(hair, hairBound < 0.415 ? MAT_HAIR : MAT_PROXY), 0.012);
  res = suni(res, vec2(beard, beardBound < 0.305 ? MAT_BEARD : MAT_PROXY), 0.01);
  res = uni(res, vec2(brows, MAT_BROW));
  return res;
}

// ------------------------------------------------------------------ guitar

float sdBody2D(vec2 p) {
  // offset double-cutaway body: long narrow upper horn, defined waist
  float d = length(p - vec2(-0.06, 0.0)) - 0.118;
  d = smin(d, length(p - vec2(0.045, 0.058)) - 0.062, 0.0135);
  d = smin(d, length(p - vec2(0.03, -0.062)) - 0.066, 0.0135);
  d = smin(d, length(p - vec2(0.125, 0.072)) - 0.027, 0.012);
  d = smin(d, length(p - vec2(0.09, -0.075)) - 0.028, 0.011);
  d = smax(d, -(length(p - vec2(0.122, -0.006)) - 0.044), 0.011);
  d = smax(d, -(length(p - vec2(0.0, 0.142)) - 0.04), 0.012);
  d = smax(d, -(length(p - vec2(0.0, -0.146)) - 0.04), 0.012);
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
  vec2 gb = g.xy / GUITAR_SCALE;
  vec2 w = vec2(sdBody2D(gb) * GUITAR_SCALE, abs(g.z) - 0.02);
  float body = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.009;
  vec2 res = vec2(body, MAT_GUITAR);
  // raised lightning-bolt pickguard, clear of the top
  float guard = max(sdBolt(gb) * GUITAR_SCALE, abs(g.z - 0.033) - 0.002) - 0.001;
  res = uni(res, vec2(guard, MAT_GUARD));
  // pickups
  float pu = sdRoundBox(g - vec3(0.05, 0.0, 0.034), vec3(0.01, 0.027, 0.003), 0.003);
  pu = min(pu, sdRoundBox(g - vec3(-0.032, 0.0, 0.034), vec3(0.01, 0.027, 0.003), 0.003));
  res = uni(res, vec2(pu, MAT_PICKUP));
  // bridge, volume and tone knobs, tuning pegs
  float metal = sdRoundBox(g - vec3(-0.08, 0.0, 0.033), vec3(0.008, 0.032, 0.003), 0.002);
  metal = min(metal, sdCapsule(g, vec3(-0.095, -0.062, 0.03), vec3(-0.095, -0.062, 0.036), 0.009));
  metal = min(metal, sdCapsule(g, vec3(-0.068, -0.085, 0.03), vec3(-0.068, -0.085, 0.036), 0.009));
  // neck and fretboard
  float neck = sdRoundBox(g - vec3(0.34, 0.0, 0.012), vec3(0.235, 0.019 - 0.004 * (g.x - 0.1), 0.01), 0.006);
  res = uni(res, vec2(neck, MAT_NECK));
  // pointed headstock
  vec3 h = g - vec3(0.625, 0.008, 0.01);
  h.xy = rot(0.12) * h.xy;
  float head = sdRoundBox(h, vec3(0.055, 0.024 - 0.12 * max(h.x, 0.0), 0.006), 0.005);
  res = uni(res, vec2(head, MAT_GUITAR));
  vec3 tq = h - vec3(-0.01, 0.034, 0.0);
  tq.x = tq.x - 0.016 * clamp(floor(tq.x / 0.016 + 0.5), -2.0, 3.0);
  metal = min(metal, length(tq) - 0.0065);
  res = uni(res, vec2(metal, MAT_METAL));
  return res;
}

// leather strap: upper horn -> behind the left shoulder -> across the back -> tail
float sdStrap(vec3 p) {
  vec3 horn = gGuitarPos + gGuitarToWorld * vec3(0.15, 0.085, -0.012);
  vec3 tail = gGuitarPos + gGuitarToWorld * vec3(-0.18, 0.0, -0.012);
  // runs behind the shoulder so it never cuts between arm and guitar
  vec3 shoulder = vec3(0.16, 1.28 - DROP, -0.085);
  vec3 back = vec3(-0.145, 1.0 - DROP, -0.145);
  vec3 side = vec3(-0.205, 0.87 - DROP, -0.015);
  float d = sdCapsule(p, horn, shoulder, 0.0085);
  d = min(d, sdCapsule(p, shoulder, back, 0.0095));
  d = min(d, sdCapsule(p, back, side, 0.0095));
  d = min(d, sdCapsule(p, side, tail, 0.0085));
  return d;
}

// ------------------------------------------------------------------- hands

// Both hands are modelled in guitar-local space so they stay on the strings.
float sdStrumHand(vec3 g) {
  vec3 P = gPalmR;
  float d = sdEllipsoid(g - P, vec3(0.034, 0.028, 0.016));
  // curled fingers fanned across the strings, tips just above the top
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float dy = (fi - 1.5) * 0.019;
    vec3 a = P + vec3(0.022, dy, -0.004);
    vec3 b = vec3(P.x + 0.044 + 0.003 * fi, P.y + dy * 1.1, 0.038);
    d = smin(d, sdTaper(g, a, b, 0.0065, 0.0058), 0.002);
  }
  // thumb pinching the pick against the index finger
  d = smin(d, sdTaper(g, P + vec3(-0.004, 0.026, 0.0), vec3(0.025, P.y + 0.01, 0.04), 0.0068, 0.0055), 0.002);
  return d;
}

float sdFretHand(vec3 g) {
  vec3 P = gPalmL;
  // palm cupped under the neck
  float d = sdEllipsoid(g - P, vec3(0.034, 0.018, 0.028));
  // fingers arch over the edge and press separate strings at separate frets
  float xs[4] = float[4](0.326, 0.347, 0.37, 0.39);
  float ys[4] = float[4](-0.012, -0.004, 0.004, 0.012);
  for (int i = 0; i < 4; i++) {
    vec3 a = vec3(xs[i] - 0.004, -0.04, 0.016);
    vec3 b = vec3(xs[i] - 0.001, -0.022, 0.036);
    vec3 c = vec3(xs[i], ys[i], 0.0265);
    d = smin(d, sdTaper(g, a, b, 0.0075, 0.0068), 0.002);
    d = smin(d, sdTaper(g, b, c, 0.0068, 0.0062), 0.002);
  }
  // thumb behind the neck
  d = smin(d, sdTaper(g, P + vec3(-0.008, 0.01, -0.02), vec3(0.37, 0.014, -0.014), 0.008, 0.007), 0.003);
  return d;
}

// ------------------------------------------------------------------- body

// Foot from heel a to toe b: heel/arch taper plus a wider toe box.
float sdFoot(vec3 p, vec3 a, vec3 b) {
  vec3 d = normalize(b - a);
  float f = sdTaper(p, a, mix(a, b, 0.7), 0.038, 0.034);
  vec3 toe = mix(a, b, 0.86);
  vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 w = p - toe;
  vec3 local = vec3(dot(w, side), dot(w, cross(side, d)), dot(w, d));
  return smin(f, sdEllipsoid(local, vec3(0.04, 0.026, 0.034)), 0.02);
}

// Leather sandal on a foot running a -> b: a sole slab under the foot plus
// three straps over the top.
float sdSandal(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 d = normalize(b - a);
  vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(side, d);
  vec3 mid = mix(a, b, 0.5);
  float sole = max(sdTaper(p, a - d * 0.014, b + d * 0.02, r1 + 0.01, r2 + 0.012), dot(p - mid, up) + 0.62 * r1);
  float straps = 1e9;
  float fr[3] = float[3](0.78, 0.5, 0.12);
  for (int i = 0; i < 3; i++) {
    vec3 c = mix(a, b, fr[i]);
    float R = mix(r1, r2, fr[i]) + 0.005;
    vec3 w = p - c;
    float along = dot(w, d);
    vec3 rr = w - along * d;
    float band = length(vec2(length(rr) - R, along)) - 0.0055;
    band = max(band, -(dot(rr, up) + 0.3 * R));
    straps = min(straps, band);
  }
  return min(sole, straps);
}

vec2 mapBody(vec3 p) {
  vec3 pu = p + vec3(0.0, DROP, 0.0);
  vec3 ux = vec3(abs(pu.x), pu.yz);

  // torso skin (shows at the shoulders, armholes and neck)
  float core = sdEllipsoid(pu - vec3(0.0, 1.08, 0.0), vec3(0.19, 0.22, 0.12));
  core = smin(core, sdEllipsoid(pu - vec3(0.0, 0.88, 0.01), vec3(0.168, 0.15, 0.118)), 0.08);
  float torso = smin(core, sdCapsule(pu, vec3(-0.165, 1.225, -0.005), vec3(0.165, 1.225, -0.005), 0.064), 0.05);
  torso = smin(torso, sdCapsule(pu, vec3(0.0, 1.2, 0.0), vec3(0.0, 1.4, 0.015), 0.056), 0.04);
  vec2 res = vec2(torso, MAT_SKIN);

  // tank: its own looser shell widening to the hem, with sewn-looking armholes
  float tank = sdEllipsoid(pu - vec3(0.0, 1.075, 0.0), vec3(0.2, 0.23, 0.132));
  tank = smin(tank, sdEllipsoid(pu - vec3(0.0, 0.87, 0.012), vec3(0.185, 0.155, 0.13)), 0.08);
  tank = smin(tank, sdCapsule(pu, vec3(-0.11, 1.25, -0.005), vec3(0.11, 1.25, -0.005), 0.062), 0.06);
  tank = smax(tank, -sdEllipsoid(ux - vec3(0.205, 1.14, -0.005), vec3(0.055, 0.11, 0.072)), 0.022);
  tank = smax(tank, -sdEllipsoid(pu - vec3(0.0, 1.31, 0.05), vec3(0.08, 0.07, 0.09)), 0.012);
  tank = smax(tank, 0.78 - pu.y, 0.012);
  res = uni(res, vec2(tank, MAT_TANK));
  res = uni(res, vec2(sdStrap(p), MAT_STRAP));

  // arms with distinct elbows and wrists
  float arms = sdTaper(p, gShoulderR, gElbowR, 0.058, 0.044);
  arms = smin(arms, sdEllipsoid(p - gElbowR, vec3(0.046, 0.048, 0.044)), 0.02);
  arms = smin(arms, sdTaper(p, gElbowR, gWristR, 0.044, 0.029), 0.022);
  arms = smin(arms, sdTaper(p, gShoulderL, gElbowL, 0.058, 0.044), 0.022);
  arms = smin(arms, sdEllipsoid(p - gElbowL, vec3(0.046, 0.048, 0.044)), 0.02);
  arms = smin(arms, sdTaper(p, gElbowL, gWristL, 0.044, 0.029), 0.022);
  vec3 g = gGuitarRot * (p - gGuitarPos);
  float hands = min(sdStrumHand(g), sdFretHand(g));
  arms = smin(arms, hands, 0.004);
  res = suni(res, vec2(arms, MAT_SKIN), 0.025);

  // loose trousers: waist, standing right leg, crossed left leg
  float pants = sdEllipsoid(p - vec3(0.0, 0.7, 0.0), vec3(0.17, 0.12, 0.12));
  pants = smin(pants, sdTaper(p, vec3(-0.085, 0.68, 0.0), vec3(-0.085, 0.39, 0.02), 0.09, 0.074), 0.04);
  pants = smin(pants, sdTaper(p, vec3(-0.085, 0.39, 0.02), vec3(-0.07, 0.15, 0.0), 0.074, 0.06), 0.025);
  pants = smin(pants, sdTaper(p, vec3(0.075, 0.68, 0.0), gKnee, 0.094, 0.074), 0.018);
  pants = smin(pants, sdTaper(p, gKnee, gAnkle + normalize(gKnee - gAnkle) * 0.03, 0.074, 0.058), 0.014);
  pants = max(pants, p.y - 0.76);
  // fabric folds bunched above and behind the crossed knee
  float folds = sdCapsule(p, vec3(0.06, 0.535, 0.15), vec3(0.145, 0.49, 0.214), 0.01);
  folds = min(folds, sdCapsule(p, vec3(0.045, 0.505, 0.172), vec3(0.13, 0.462, 0.226), 0.008));
  folds = min(folds, sdCapsule(p, vec3(0.105, 0.455, 0.155), vec3(0.15, 0.43, 0.195), 0.008));
  pants = smax(pants, -folds, 0.004);
  res = suni(res, vec2(pants, MAT_PANTS), 0.008);

  // bare feet in sandals
  vec3 heelR = vec3(-0.07, 0.132, -0.01), toeR = vec3(-0.075, 0.12, 0.115);
  float feet = min(sdFoot(p, heelR, toeR), sdFoot(p, gAnkle, gToe));
  res = suni(res, vec2(feet, MAT_SKIN), 0.02);
  float sandals = min(sdSandal(p, heelR, toeR, 0.038, 0.036), sdSandal(p, gAnkle, gToe, 0.036, 0.034));
  res = uni(res, vec2(sandals, MAT_SANDAL));

  // square pedestal with a shallow raised top plate
  float base = sdRoundBox(p - vec3(0.0, 0.04, 0.02), vec3(0.28, 0.035, 0.28), 0.01);
  base = min(base, sdRoundBox(p - vec3(0.0, 0.076, 0.02), vec3(0.245, 0.004, 0.245), 0.006));
  res = uni(res, vec2(base, MAT_BASE));
  return res;
}

// ------------------------------------------------------------------ scene

vec2 map(vec3 p) {
  vec2 res = mapBody(p);

  float hb = length(p - gHeadCenter) - 0.46 * gHeadScale;
  if (hb < 0.05) {
    vec3 q = gHeadRot * (p - gNeck) / gHeadScale - vec3(0.0, HEAD_LIFT, 0.0);
    vec2 h = mapHead(q);
    h.x *= gHeadScale;
    res = suni(res, h, 0.01);
  } else {
    res = uni(res, vec2(hb, MAT_PROXY));
  }

  float gb = length(p - gGuitarPos) - 0.8;
  res = uni(res, gb < 0.05 ? mapGuitar(p) : vec2(gb, MAT_PROXY));
  return res;
}

vec3 calcNormal(vec3 p, float e) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

// penumbra-aware soft shadow with small adaptive steps
float softShadow(vec3 ro, vec3 rd) {
  // start clear of the surface
  float vis = 1.0, ph = 1e6, t = 0.025;
  for (int i = 0; i < 56; i++) {
    vec2 hm = map(ro + rd * t);
    float h = hm.x;
    // bounding-sphere stand-ins only set the step; they are not occluders
    if (hm.y == MAT_PROXY) {
      t += h;
      // the next real sample has no meaningful predecessor
      ph = 1e6;
      if (t > 2.5) break;
      continue;
    }
    if (h < 0.0005) return 0.0;
    // penumbra estimate; y must stay below h or d collapses to 0 (black specks)
    float y = min(h * h / (2.0 * ph), 0.9 * h);
    float d = sqrt(h * h - y * y);
    vis = min(vis, 10.0 * d / max(0.001, t - y));
    ph = h;
    t += clamp(h * 0.8, 0.0035, 0.075);
    if (t > 2.5) break;
  }
  return smoothstep(0.0, 1.0, clamp(vis, 0.0, 1.0));
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.015 + 0.04 * float(i);
    occ += max(h - map(p + n * h).x, 0.0) * w;
    w *= 0.68;
  }
  return exp(-5.0 * occ);
}

// --------------------------------------------------------------- shading

vec3 shade(vec3 p, vec3 n, vec3 rd, float mat) {
  vec3 alb = vec3(0.8);
  float specAmt = 0.15, shin = 24.0, sss = 0.0, aniso = 0.0, rimAmt = 1.0;
  vec3 strandT = vec3(0.0);
  vec3 q = gHeadRot * (p - gNeck) / gHeadScale - vec3(0.0, HEAD_LIFT, 0.0);
  vec3 g = gGuitarRot * (p - gGuitarPos);

  if (mat == MAT_SKIN) {
    alb = vec3(0.58, 0.37, 0.27);
    if (length(p - gHeadCenter) < 0.45 * gHeadScale) {
      vec3 qx = vec3(abs(q.x), q.yz);
      // redder cheeks and nose, browner forehead, cooler darker sockets
      float flush = smoothstep(0.06, 0.0, length(qx - vec3(0.075, -0.05, 0.11)));
      flush += 1.2 * smoothstep(0.045, 0.0, length(q - vec3(0.0, -0.072, 0.19)));
      alb *= mix(vec3(1.0), vec3(1.16, 0.93, 0.88), clamp(flush, 0.0, 1.0));
      alb *= mix(vec3(1.0), vec3(0.95, 0.92, 0.88), smoothstep(0.04, 0.1, q.y));
      alb *= mix(vec3(1.0), vec3(0.9, 0.9, 0.95), smoothstep(0.035, 0.0, length(qx - vec3(0.056, -0.012, 0.14))));
    } else {
      alb *= vec3(0.95, 0.91, 0.86);
    }
    sss = 1.0; specAmt = 0.1; shin = 40.0;
  } else if (mat == MAT_HAIR) {
    float sideW = smoothstep(0.075, 0.16, abs(q.x));
    // same parting-point flow as the geometry; broad low-frequency lock tone
    // dominates so the grooves are not echoed by matching stripes
    float u = atan(q.x, 0.24 - q.z);
    u += 0.09 * q.y + 0.04 * sin(3.7 * u + q.y * 11.0);
    float lockTone = fbm(q * vec3(7.0, 4.0, 7.0));
    float strandTone = 0.5 + 0.5 * sin(u * 37.0 + q.y * 5.0);
    alb = mix(vec3(0.55, 0.56, 0.57), vec3(0.92, 0.9, 0.86), clamp(0.57 + 0.2 * lockTone + 0.035 * strandTone, 0.0, 1.0));
    vec3 dirLocal = normalize(mix(vec3(0.0, 0.02, -1.0), vec3(0.0, -0.88, -0.48), sideW));
    vec3 dW = transpose(gHeadRot) * dirLocal;
    strandT = normalize(dW - n * dot(n, dW));
    aniso = 0.32; specAmt = 0.085; shin = 38.0; rimAmt = 1.2;
  } else if (mat == MAT_BEARD) {
    float u = q.x + 0.15 * q.z + 0.05 * sin(q.y * 30.0);
    float n2 = fbm(q * 14.0);
    float fine = 0.5 + 0.5 * sin(u * 90.0 + n2 * 4.0);
    alb = mix(vec3(0.66, 0.64, 0.61), vec3(0.88, 0.86, 0.82), 0.54 + 0.12 * n2 + 0.04 * fine);
    // darker where the moustache meets the beard
    alb *= 1.0 - 0.2 * smoothstep(0.03, 0.0, abs(q.y + 0.127)) * smoothstep(0.05, 0.0, abs(q.x));
    vec3 dW = transpose(gHeadRot) * vec3(0.0, -1.0, 0.0);
    strandT = normalize(dW - n * dot(n, dW));
    aniso = 0.075; specAmt = 0.025; shin = 30.0;
  } else if (mat == MAT_BROW) {
    alb = vec3(0.34, 0.33, 0.32) * (0.94 + 0.08 * noise(q * 35.0));
    specAmt = 0.025; shin = 18.0;
  } else if (mat == MAT_EYE) {
    float side = q.x < 0.0 ? -1.0 : 1.0;
    vec3 d = normalize(q - eyeCenter(side));
    float c = dot(d, normalize(vec3(0.0, 0.02, 1.0)));
    alb = vec3(0.74, 0.7, 0.64);
    alb = mix(alb, vec3(0.3, 0.42, 0.5), smoothstep(0.88, 0.9, c));
    alb = mix(alb, vec3(0.03), smoothstep(0.962, 0.972, c));
    // painted catchlight, upper left of the iris
    float cl = dot(d, normalize(vec3(-0.18, 0.2, 1.0)));
    alb = mix(alb, vec3(1.6), smoothstep(0.993, 0.996, cl));
    specAmt = 0.9; shin = 120.0;
  } else if (mat == MAT_TANK) {
    alb = vec3(0.1, 0.105, 0.11) * (0.985 + 0.015 * noise(p * vec3(4.0, 7.0, 4.0)));
    specAmt = 0.025; shin = 7.0; rimAmt = 0.3;
  } else if (mat == MAT_PANTS) {
    alb = vec3(0.82, 0.77, 0.66) * (0.985 + 0.015 * noise(p * vec3(3.0, 6.0, 3.0)));
    specAmt = 0.025; shin = 7.0;
  } else if (mat == MAT_SANDAL) {
    // dark sole, lighter straps
    alb = n.y < -0.3 || p.y < 0.105 ? vec3(0.26, 0.15, 0.08) : vec3(0.5, 0.3, 0.16);
    specAmt = 0.3; shin = 40.0;
  } else if (mat == MAT_STRAP) {
    alb = vec3(0.16, 0.09, 0.05);
    specAmt = 0.2; shin = 30.0;
  } else if (mat == MAT_GUITAR) {
    alb = vec3(0.32, 0.6, 0.78);
    specAmt = 0.45; shin = 70.0;
  } else if (mat == MAT_GUARD) {
    alb = vec3(0.93, 0.93, 0.9);
    specAmt = 0.35; shin = 60.0;
  } else if (mat == MAT_PICKUP) {
    alb = vec3(0.06);
    specAmt = 0.3; shin = 50.0;
  } else if (mat == MAT_NECK) {
    alb = vec3(0.13, 0.1, 0.08);
    float fret = abs(fract((g.x - 0.11) / 0.03) - 0.5) * 0.03;
    if (fret < 0.0012 && g.z > 0.015) alb = vec3(0.75);
    specAmt = 0.3; shin = 50.0;
  } else if (mat == MAT_METAL) {
    alb = vec3(0.75); specAmt = 0.8; shin = 100.0;
  } else if (mat == MAT_BASE) {
    alb = vec3(0.07); specAmt = 0.12; shin = 30.0;
  }

  // six strings from bridge to nut, painted onto whatever lies under them
  if (mat >= MAT_GUITAR && mat != MAT_METAL && mat < MAT_BROW && g.z > 0.026 && g.x > -0.08 && g.x < 0.58) {
    float spacing = mix(0.0062, 0.0045, clamp((g.x + 0.08) / 0.66, 0.0, 1.0));
    float idx = g.y / spacing + 2.5;
    if (idx > -0.5 && idx < 5.5 && abs(fract(idx) - 0.5) > 0.4) {
      alb = vec3(0.82); specAmt = 0.8; shin = 100.0;
    }
  }

  vec3 key = normalize(vec3(-0.65, 0.7, 0.38));
  vec3 fill = normalize(vec3(0.45, 0.15, 1.0));
  vec3 rim = normalize(vec3(0.75, 0.35, -0.6));
  vec3 v = -rd;
  float ndl = dot(n, key);
  float dif = clamp(ndl, 0.0, 1.0);
  float wrap = clamp((ndl + 0.25) / 1.25, 0.0, 1.0);
  float sh = softShadow(p + n * 0.012, key);
  float ao = calcAO(p, n);

  vec3 col = vec3(0.0);
  // key light, wrapped on skin so the terminator goes warm instead of grey
  vec3 diffuse = mix(vec3(dif), vec3(wrap) * vec3(1.0, 0.72, 0.62) + vec3(dif) * vec3(0.0, 0.28, 0.38), sss);
  col += alb * diffuse * vec3(1.2, 1.12, 1.02) * mix(sh, 1.0, 0.08);
  // weak front fill
  col += alb * clamp(dot(n, fill), 0.0, 1.0) * vec3(0.09, 0.087, 0.084) * ao;
  // sky and warm ground bounce
  float sky = 0.5 + 0.5 * n.y;
  col += alb * mix(vec3(0.136, 0.104, 0.08), vec3(0.2, 0.224, 0.264), sky) * ao;
  // cool rim, partly independent of albedo so dark and silver edges separate
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
  float rl = clamp(dot(n, rim), 0.0, 1.0) * (0.35 + 0.65 * ao);
  col += mix(alb, vec3(0.45), 0.35) * vec3(0.5, 0.6, 0.8) * rl * 0.45 * rimAmt;
  col += vec3(0.6, 0.7, 0.9) * fres * 0.05 * rimAmt * ao;
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

vec4 renderSample(vec2 fc, float edge) {
  vec2 uv = (fc - 0.5 * uRes) / uRes.y;
  vec3 target = mix(vec3(0.0, 1.14, 0.0), gHeadCenter + vec3(0.0, -0.02, 0.0), uFocus);
  float dist = mix(4.6, 2.3, uFocus);
  vec3 ro = target + vec3(sin(uYaw) * dist, mix(0.35, 0.05, uFocus), cos(uYaw) * dist);
  vec3 cw = normalize(target - ro);
  vec3 cu = normalize(cross(cw, vec3(0, 1, 0)));
  vec3 cv = cross(cu, cw);
  vec3 rd = normalize(uv.x * cu + uv.y * cv + 1.9 * cw);
  float pix = 1.0 / (uRes.y * 1.9);

  // only march inside a cylinder around the figure
  vec2 oc = ro.xz, dd = rd.xz;
  float b = dot(oc, dd), c = dot(oc, oc) - 0.7 * 0.7, a = dot(dd, dd);
  float disc = b * b - a * c;
  if (disc < 0.0) return vec4(0.0);
  float t = max((-b - sqrt(disc)) / a, 0.0);
  float tMax = (-b + sqrt(disc)) / a;

  // march, remembering the closest grazing approach for antialiased edges
  float bestRatio = 1e9, bestT = t, mat = 0.0;
  bool hit = false;
  for (int i = 0; i < 220; i++) {
    vec3 p = ro + rd * t;
    if (p.y < -0.02 || (p.y > 2.5 && rd.y > 0.0)) break;
    vec2 h = map(p);
    float ratio = h.x / max(t, 0.001);
    if (ratio < bestRatio) { bestRatio = ratio; bestT = t; mat = h.y; }
    float hitEps = clamp(0.18 * pix * t, 0.00008, 0.0003);
    if (h.x < hitEps) { hit = true; bestT = t; mat = h.y; break; }
    t += max(h.x * 0.8, hitEps * 0.5);
    if (t > tMax) break;
  }

  float alpha = hit ? 1.0 : 1.0 - smoothstep(0.0, edge * pix, bestRatio);
  if (alpha <= 0.0) return vec4(0.0);

  vec3 p = ro + rd * bestT;
  vec3 n = calcNormal(p, clamp(0.3 * pix * bestT, 0.0002, 0.00075));
  vec3 col = shade(p, n, rd, mat);

  // filmic tone map and gamma
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  return vec4(col * alpha, alpha);
}

void main() {
  setupPose(uTime);
  if (uAA <= 1) {
    fragColor = renderSample(gl_FragCoord.xy, 1.5);
    return;
  }
  // 2x2 rotated-grid supersampling
  vec4 acc = renderSample(gl_FragCoord.xy + vec2(-0.125, -0.375), 1.0);
  acc += renderSample(gl_FragCoord.xy + vec2(0.375, -0.125), 1.0);
  acc += renderSample(gl_FragCoord.xy + vec2(0.125, 0.375), 1.0);
  acc += renderSample(gl_FragCoord.xy + vec2(-0.375, 0.125), 1.0);
  fragColor = acc * 0.25;
}
