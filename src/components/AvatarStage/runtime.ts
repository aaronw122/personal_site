import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  FLOOR_PX,
  PEEK_BOX,
  PEEK_OUT,
  peekBottomPx,
  stageScenePx,
} from "./stageLayout";
import { normalizeAvatar, retargetClip, type RestPose } from "./retarget";

const LEG_CHAIN = /^(left|right)(upleg|leg|foot|toe)/;

const ARM_CHAIN = /^(left|right)(arm|forearm)$/;

const HAND_CHAIN = /^(left|right)hand/;

const HEAD_CHAIN = /^(neck|head)/;

const PEEK_RELEASE = 0.6;

const ARM_RELEASE = [0.4, 0.55] as const;

const ELBOW_RELEASE = [0.6, 0.55] as const;

const RELEASE_DROP = [0, 0.1] as const;

const RELEASE_ARC = [0, 0.5] as const;

const WRIST_RELEASE = ARM_RELEASE;

const SPRITE_DECAL = {
  x: 112,
  top: 128,
  bottom: 206,
  feather: 8,
  fade: [0.12, 0.4],
} as const;

type SpriteDecal = {
  map: THREE.Texture;
  mix: { value: number };
  meshes: { mesh: THREE.SkinnedMesh; uv: THREE.BufferAttribute }[];
};

const HAND_RELEASE = 0.75;

function swingArm(
  shoulder: THREE.Bone,
  from: THREE.Vector3,
  to: THREE.Vector3,
) {
  q.setFromUnitVectors(from, to);
  shoulder.parent!.getWorldQuaternion(armTurn).invert();
  shoulder.quaternion.copy(
    shoulder.getWorldQuaternion(armTurn2).premultiply(q).premultiply(armTurn),
  );
  shoulder.updateWorldMatrix(false, true);
}

function slerpDirection(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
) {
  const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  if (angle < 1e-4) return out.lerpVectors(a, b, t).normalize();
  const wa = Math.sin((1 - t) * angle) / Math.sin(angle),
    wb = Math.sin(t * angle) / Math.sin(angle);
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb);
}

function letGo(elapsed: number, duration: number) {
  const x = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
  return x * x * (6 - 8 * x + 3 * x * x);
}

function windUp(x: number) {
  const u = 1 - THREE.MathUtils.clamp(x, 0, 1);
  return 1 - u ** 4 * (1 + 4 * (1 - u));
}

const PUSH_LOWER = 0.027;

const FALL_GRAVITY = 2.7;

const DROP_DRIFT_PX = 76;

const PUSH_BURST = 1.8;

const FALL_DRIFT_END = 0.7;

const WINDUP_PX = 15;

const WINDUP_LEAN = 22;

const STEP_WINDOWS = [
  [0.72, 0.98],
  [0.45, 0.65],
] as const;
const STEP_LIFT = 0.042;

const SWING_LIFT = 0.6;

const STEP_WEIGHT = {
  shift: 5.5,
  drop: 1,
  rise: 1.75,
  roll: 2.5,
  lead: 0.1,
  follow: [
    [0.14, 0.12],
    [0.04, 0.12],
  ],
} as const;

function strike(t: number, [start, end]: readonly [number, number]) {
  return (
    1 -
    Math.cos(
      (Math.PI / 2) * THREE.MathUtils.clamp((t - start) / (end - start), 0, 1),
    )
  );
}

const LAND_SQUASH = {
  y: 0.03,
  x: 0.015,
  peak: 0.08,
  rest: 0.25,
  end: 0.4,
  overshoot: -1 / 6,
} as const;
function landSquash(t: number) {
  if (t <= 0 || t >= LAND_SQUASH.end) return 0;
  if (t < LAND_SQUASH.peak)
    return THREE.MathUtils.smoothstep(t, 0, LAND_SQUASH.peak);
  if (t < LAND_SQUASH.rest)
    return (
      1 - THREE.MathUtils.smoothstep(t, LAND_SQUASH.peak, LAND_SQUASH.rest)
    );
  return (
    LAND_SQUASH.overshoot *
    Math.sin(
      (Math.PI * (t - LAND_SQUASH.rest)) / (LAND_SQUASH.end - LAND_SQUASH.rest),
    ) **
      2
  );
}

const TURN_LEAD = { head: 0.1, hips: 0.15 } as const;

const LANDED_GLANCE = { start: 0.29, end: 0.41, yaw: 17, chin: 3 } as const;

const KNEE_FORWARD = { roll: 6, start: 0.8, end: 1.1 } as const;

const STRUM_PULSE = {
  chest: 1,
  nod: 2.5,
  pick: 0.97,
  chestLag: 1 / 30,
  nodLag: 2 / 30,
  fadeIn: [0.25, 0.75],
} as const;

const PAUSE_IDLE = { ease: 0.42, yaw: 10, pitch: 2.25, scan: 6.4 } as const;

const TRACK_CHANGE = {
  finishMin: 0.06,
  finishMax: 0.3,
  attack: 0.28,
  releaseAt: 1.18,
  end: 1.5,
  headPitch: -8,
  handUp: 0.065,
  handOut: 0.055,
  handSide: -0.025,
} as const;

const HUP = {
  out: 2.5,
  up: 1,
  peak: 0.1,
  release: 0.2,
  delay: 2 / 30,
} as const;

const PEEK_SCALE_TIME = 0.2;

const HANDOFF = 0.25;

const GUITAR_PULL = {
  rate: 0.6,
  reach: [0, 0.42],
  grab: [0.3, 0.44],
  carry: {
    t: [0.42, 0.61, 0.82, 0.9, 0.98, 1.04],
    x: [0.015, -0.16, -0.2, -0.1, -0.015, 0],
    y: [-0.06, -0.05, 0, 0.01, 0, 0],
    z: [-0.35, -0.244, 0, 0.06, 0.016, 0],
    roll: [-117, -110, -82, -45, -15, 0],
    pitch: [0, 0, 0, 0, 0, 0],
    yaw: [0, 0, 0, 0, 0, 0],
  },
  elbow: {
    x: [-1, -0.7, -0.7, -0.7, -0.7, -0.7],
    y: [-0.2, -0.2, -0.2, -0.2, -0.2, -0.2],
    z: [-0.6, -1.5, -1.5, -1.5, -1.5, -1.5],
  },
  via: [-0.1, -0.2, -0.05],
  viaAt: 0.4,
  soft: [0.87, 0.9, 0.9, 0.94],
  settle: [1.19, 1.34],
  strum: 1.22,
  ease: 0.12,
  end: 1.34,
  left: {
    at: [0.9, 1.2],
    turn: [0.8, 1.2],
    via: [0.05, -0.14, -0.06],
    fingers: [1.08, 1.24],
    thumb: [1, 1.16],
    elbow: [1, -1, -0.3],
  },

  hangHold: 2 / 30,
  clear: { at: [0.68, 0.72, 1, 1.04], offset: [-0.007, -0.007, 0.004] },
} as const;

const GUITAR_CATCH = {
  at: GUITAR_PULL.carry.t[GUITAR_PULL.carry.t.length - 1],
  peak: 2 / 30,
  recover: 4 / 30,
  hands: 2.5,
} as const;

const EXIT = {
  rate: 1.4,
  guitar: [0, 0.12],
  guitarSpin: 40,
  guitarShrink: [0.02, 5 / 30],
  pose: [0.06, 0.36],
  hopPose: 0.85,
  turn: [0.14, 0.46],
  headLead: 2 / 30,
  walk: [0.12, 0.45],
  clear: 14,
  max: 2.5,
} as const;

const WALK = {
  stride: 1.1,
  start: 0.55,
  hip: [18, 16, 10, 3, -4, -9, 0, 16, 21, 21],
  knee: [4, 11, 9, 5, 5, 14, 46, 64, 44, 12],
  foot: [15, 2, 0, 0, -2, -11, -28, -15, -2, 10],
  toeFlat: [0.4, 0.48, 0.6, 0.67],
  toeOff: 0.58,
  lift: 1.5,
  lock: 10,
  overHold: 0.03,
  release: 0.18,
  firstStep: [0.02, 0.34],
  planted: 0.3,
  landing: 0.88,
  arm: [2, 22],
  armPeak: 0.95,
  elbow: [12, 8],
  elbowLag: 0.06,
  wrist: [3, 8],
  wristLag: 0.12,
  pelvis: 5,
  chest: 4,
  lean: 4,
  headPitch: 4,
} as const;

function loopCurve(keys: readonly number[], p: number) {
  const n = keys.length,
    x = (((p % 1) + 1) % 1) * n,
    i = Math.floor(x),
    u = x - i;
  const a = keys[(i + n - 1) % n],
    b = keys[i % n],
    c = keys[(i + 1) % n],
    d = keys[(i + 2) % n];
  return (
    b +
    0.5 *
      u *
      (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a)))
  );
}

function pchip(xs: readonly number[], ys: readonly number[], x: number) {
  const last = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[last]) return ys[last];
  let i = 0;
  while (x > xs[i + 1]) i++;
  const slope = (k: number) => (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
  const tangent = (k: number) => {
    if (k === 0 || k === last) return 0;
    const a = slope(k - 1),
      b = slope(k);
    if (a * b <= 0) return 0;
    const wa = 2 * (xs[k + 1] - xs[k]) + (xs[k] - xs[k - 1]),
      wb = xs[k + 1] - xs[k] + 2 * (xs[k] - xs[k - 1]);
    return (wa + wb) / (wa / a + wb / b);
  };
  const h = xs[i + 1] - xs[i],
    u = (x - xs[i]) / h;
  return (
    (2 * u ** 3 - 3 * u * u + 1) * ys[i] +
    (u ** 3 - 2 * u * u + u) * h * tangent(i) +
    (-2 * u ** 3 + 3 * u * u) * ys[i + 1] +
    (u ** 3 - u * u) * h * tangent(i + 1)
  );
}

export type StageState = "peek" | "hop" | "strum";
export type StageSnapshot = {
  state: StageState;
  id: string;
  bpm: number;
  distance: [number, number];
  frameMs: number;
  ready: boolean;
  trackTitle: string;
  trackIndex: number;
  trackCount: number;
  paused: boolean;
  musicError?: boolean;
  exiting?: boolean;
};
type Track = {
  title: string;
  artist: string;
  show: string;
  archive: string;
  src: string;
};
type Metadata = {
  id: string;
  name: string;
  guitar: {
    src: string;
    position: [number, number, number];
    rotation: [number, number, number];
  };
  tracks?: Track[];
  track?: { src: string; bpm: number };
};
type PeekJson = {
  root: {
    position: THREE.Vector3Tuple;
    quaternion: THREE.QuaternionTuple;
    scale: THREE.Vector3Tuple;
  };
  bones: Record<
    string,
    {
      position: THREE.Vector3Tuple;
      quaternion: THREE.QuaternionTuple;
      scale?: THREE.Vector3Tuple;
    }
  >;
  camera: { left: number; top: number };
  pixelsPerUnit: number;
};

type PeekBone = {
  bone: THREE.Bone;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  role: "body" | "arm" | "hand";
};

type PeekPose = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  bones: PeekBone[];
  left: number;
  top: number;
  pixelsPerUnit: number;
};
type HopSitPhases = {
  pullOut: number;
  pushStart: number;
  takeoff: number;
  fallHoldStart: number;
  fallHoldEnd: number;
  contact: number;
  turnStart: number;
  turnEnd: number;
  settled: number;
  toeHeightAtContact: number;
};
type Arm = [shoulder: THREE.Bone, elbow: THREE.Bone, hand: THREE.Bone];
type Finger = {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  curl: number;
  splay: number;
  left: boolean;
};
type FrettingFinger = {
  joints: [THREE.Bone, THREE.Bone, THREE.Bone];
  rest: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  angles: [number, number, number];
  target: THREE.Vector3;
};

type HopTrack = {
  bone: THREE.Bone;
  property: "quaternion" | "position";
  interpolant: THREE.Interpolant;
};

type ExitFoot = { heel: number; ball: number; shift: number; low: number };
type Loaded = {
  root: THREE.Group;
  facing: number;
  baseScale: THREE.Vector3;
  skeleton: THREE.Bone[];
  metadata: Metadata;
  mixer: THREE.AnimationMixer;
  strum: THREE.AnimationAction;
  hopSit: THREE.AnimationAction;
  hopSitTracks: HopTrack[];
  hopSitPhases: HopSitPhases;
  toes: [THREE.Bone, THREE.Bone];
  heels: [
    { foot: THREE.Bone; local: THREE.Vector3 },
    { foot: THREE.Bone; local: THREE.Vector3 },
  ];
  toeRest: number;
  hips: THREE.Bone;
  head: THREE.Bone;
  headCentre: THREE.Vector3;
  peekPose: PeekPose;
  authoredStrum: boolean;
  strumBpm: number;
  prop: THREE.Object3D | null;
  targets: [THREE.Object3D, THREE.Object3D] | null;
  arms: [Arm, Arm] | null;
  restPositions: THREE.Vector3[];
  restScales: THREE.Vector3[];
  wristRest: [THREE.Vector3, THREE.Vector3] | null;
  wristRotation: [THREE.Quaternion, THREE.Quaternion] | null;
  fingers: Finger[];
  fretting: FrettingFinger[];
  thumb: [THREE.Bone, THREE.Bone, THREE.Bone] | null;
  thumbRest: THREE.Quaternion[];
  pickIndex: THREE.Bone | null;
};
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const turn = new THREE.Quaternion();
const axis = new THREE.Vector3();
const q = new THREE.Quaternion();
const pole = new THREE.Vector3();
const armAxis = new THREE.Vector3();
const elbowRadial = new THREE.Vector3();
const poleRadial = new THREE.Vector3();
const cross = new THREE.Vector3();
const fingerRotation = new THREE.Quaternion();
const fingerSpread = new THREE.Quaternion();
const neckAlong = new THREE.Vector3();
const neckUp = new THREE.Vector3();
const neckSide = new THREE.Vector3();
const neckOrigin = new THREE.Vector3();
const fingerBase = new THREE.Vector3();
const fingerEnd = new THREE.Vector3();
const fingerDesired = new THREE.Vector3();
const fingerHingeWorld = new THREE.Vector3();
const fingerWorldQuat = new THREE.Quaternion();
const bodyUp = new THREE.Vector3();
const handAim = new THREE.Vector3();
const handDesired = new THREE.Vector3();
const handWorldCorrection = new THREE.Quaternion();
const handParentWorld = new THREE.Quaternion();
const handLocalCorrection = new THREE.Quaternion();
const pickWristGoal = new THREE.Object3D();

const pauseWristGoal = new THREE.Object3D();
const pauseNormal = new THREE.Vector3();

const trackWristGoal = new THREE.Object3D();
const norm = (name: string) => name.replace(/^mixamorig:?/, "").toLowerCase();
const wristGoal = new THREE.Object3D();
const maxFingerFlex = THREE.MathUtils.degToRad(100);
const pickTipWorld = new THREE.Vector3();

const armClip: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion] = [
  new THREE.Quaternion(),
  new THREE.Quaternion(),
  new THREE.Quaternion(),
];

const trackArmSolved: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion] = [
  new THREE.Quaternion(),
  new THREE.Quaternion(),
  new THREE.Quaternion(),
];
const armWrist = new THREE.Vector3();

const armTurn = new THREE.Quaternion();
const armTurn2 = new THREE.Quaternion();

const footGoal = new THREE.Object3D();
const kneeHint = new THREE.Vector3();
const footTurn = new THREE.Quaternion();
const toeGoals = [new THREE.Vector3(), new THREE.Vector3()] as const;

const legWalk: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion] = [
  new THREE.Quaternion(),
  new THREE.Quaternion(),
  new THREE.Quaternion(),
];
const bendUpper = new THREE.Vector3();
const bendLower = new THREE.Vector3();

const guitarParent = new THREE.Quaternion();
const guitarPivot = new THREE.Vector3();
const guitarAxis = new THREE.Vector3();
const guitarSpin = new THREE.Quaternion();

const pullRoot = new THREE.Quaternion();
const pullRootInverse = new THREE.Quaternion();
const pullPosed = new THREE.Quaternion();
const pullTurn = new THREE.Quaternion();
const pullEuler = new THREE.Euler();
const pullOffset = new THREE.Vector3();
const pullPivot = new THREE.Vector3();
const pullGuitarWorld = new THREE.Matrix4();
const pullStep = new THREE.Matrix4();
const pullGoal = new THREE.Matrix4();
const pullGoalPosition = new THREE.Vector3();
const pullGoalRotation = new THREE.Quaternion();
const pullScale = new THREE.Vector3();
const pullHint = new THREE.Vector3();

const pullClipWrist = [new THREE.Vector3(), new THREE.Vector3()] as const;
const pullClipHand = [new THREE.Quaternion(), new THREE.Quaternion()] as const;
const pullClipElbow = [new THREE.Vector3(), new THREE.Vector3()] as const;

const reachShoulder = new THREE.Vector3();
const reachElbow = new THREE.Vector3();
const reachWrist = new THREE.Vector3();
const reachAxis = new THREE.Vector3();
const reachBend = new THREE.Vector3();
const reachAim = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

function twistWorld(bone: THREE.Bone, angle: number, about = worldUp) {
  bone.parent!.getWorldQuaternion(armTurn);
  bone.quaternion
    .premultiply(armTurn)
    .premultiply(q.setFromAxisAngle(about, angle))
    .premultiply(armTurn.invert());
  bone.updateWorldMatrix(false, true);
}

const walkForward = new THREE.Vector3();
const walkSide = new THREE.Vector3();
const walkGoal = new THREE.Vector3();
const aimFrom = new THREE.Vector3();
const aimDir = new THREE.Vector3();
const aimTurn = new THREE.Quaternion();
const aimWeighted = new THREE.Quaternion();

function aimBone(
  bone: THREE.Bone,
  child: THREE.Object3D,
  to: THREE.Vector3,
  weight: number,
) {
  bone.getWorldPosition(aimFrom);
  child.getWorldPosition(aimDir).sub(aimFrom).normalize();
  aimWeighted.identity().slerp(aimTurn.setFromUnitVectors(aimDir, to), weight);
  bone.parent!.getWorldQuaternion(armTurn);
  bone.quaternion
    .premultiply(armTurn)
    .premultiply(aimWeighted)
    .premultiply(armTurn.invert());
  bone.updateWorldMatrix(false, true);
}

function rollKnee(
  [thigh, knee, foot]: Arm,
  angle: number,
  outward: THREE.Vector3,
) {
  foot.getWorldQuaternion(footTurn);
  thigh.getWorldPosition(tmpA);
  armAxis.subVectors(foot.getWorldPosition(tmpC), tmpA).normalize();
  elbowRadial.subVectors(knee.getWorldPosition(tmpB), tmpA);
  elbowRadial.addScaledVector(armAxis, -elbowRadial.dot(armAxis));
  poleRadial.copy(outward).addScaledVector(armAxis, -outward.dot(armAxis));
  const signed = Math.atan2(
    cross.crossVectors(elbowRadial, poleRadial).dot(armAxis),
    elbowRadial.dot(poleRadial),
  );
  thigh.parent!.getWorldQuaternion(q).invert();
  thigh.quaternion.premultiply(
    turn.setFromAxisAngle(
      armAxis.applyQuaternion(q),
      Math.sign(signed) * Math.min(angle, Math.abs(signed)),
    ),
  );
  thigh.updateWorldMatrix(false, true);
  foot.quaternion.copy(knee.getWorldQuaternion(q).invert().multiply(footTurn));
  foot.updateWorldMatrix(false, true);
}

function bendLeg(leg: Arm, toe: THREE.Bone, goal: THREE.Vector3) {
  const [thigh, knee, foot] = leg;
  foot.getWorldQuaternion(footTurn);
  thigh.getWorldPosition(tmpA);
  knee.getWorldPosition(tmpB);
  foot.getWorldPosition(tmpC);
  footGoal.position.copy(tmpC).add(goal).sub(toe.getWorldPosition(pole));
  const upper = tmpA.distanceTo(tmpB),
    lower = tmpB.distanceTo(tmpC);
  const reach = THREE.MathUtils.clamp(
    footGoal.position.distanceTo(tmpA),
    Math.abs(upper - lower) + 1e-6,
    upper + lower - 1e-6,
  );
  armAxis.subVectors(tmpB, tmpA);
  elbowRadial.subVectors(tmpC, tmpB);
  const flex =
    Math.PI -
    Math.acos(
      THREE.MathUtils.clamp(
        (upper * upper + lower * lower - reach * reach) / (2 * upper * lower),
        -1,
        1,
      ),
    ) -
    armAxis.angleTo(elbowRadial);
  cross.crossVectors(armAxis, elbowRadial).normalize();
  knee.parent!.getWorldQuaternion(armTurn).invert();
  knee.quaternion.copy(
    knee
      .getWorldQuaternion(armTurn2)
      .premultiply(q.setFromAxisAngle(cross, flex))
      .premultiply(armTurn),
  );
  knee.updateWorldMatrix(false, true);
  swingArm(
    thigh,
    foot.getWorldPosition(tmpC).sub(tmpA).normalize(),
    tmpB.subVectors(footGoal.position, tmpA).normalize(),
  );
  foot.quaternion.copy(knee.getWorldQuaternion(q).invert().multiply(footTurn));
  foot.updateWorldMatrix(false, true);
}

function plantFoot(leg: Arm, toe: THREE.Bone, goal: THREE.Vector3) {
  const [thigh, knee, foot] = leg;
  toe.getWorldPosition(pole).negate().add(goal);
  if (pole.lengthSq() < 1e-10) return;
  foot.getWorldQuaternion(footTurn);
  foot.getWorldPosition(footGoal.position).add(pole);
  knee.getWorldPosition(kneeHint).add(pole);
  solveArm(thigh, knee, foot, footGoal, 1);
  steerElbow(leg, footGoal, kneeHint);
  knee.updateWorldMatrix(true, false);
  foot.quaternion.copy(knee.getWorldQuaternion(q).invert().multiply(footTurn));
  foot.updateWorldMatrix(false, true);
}
function fitFrets(fingers: FrettingFinger[], weight: number) {
  for (let index = 0; index < fingers.length; index++) {
    const finger = fingers[index];

    finger.target
      .copy(neckOrigin)
      .addScaledVector(neckAlong, (index - 1.5) * 0.01)
      .addScaledVector(neckUp, -0.0105)
      .addScaledVector(neckSide, 0.002);
    for (let joint = 0; joint < 3; joint++)
      finger.joints[joint].quaternion.copy(finger.rest[joint]);
    finger.angles[0] = finger.angles[1] = finger.angles[2] = 0;
    if (weight < 0.6) continue;
    const flexWeight = THREE.MathUtils.smoothstep(weight, 0.6, 1);
    for (let iteration = 0; iteration < 3; iteration++)
      for (let joint = 2; joint >= 0; joint--) {
        const bone = finger.joints[joint];
        bone.updateWorldMatrix(true, true);
        bone.getWorldPosition(fingerBase);
        finger.joints[2].getWorldPosition(fingerEnd);
        fingerDesired.copy(finger.target).sub(fingerBase).normalize();
        fingerEnd.sub(fingerBase).normalize();
        bone.getWorldQuaternion(fingerWorldQuat);
        fingerHingeWorld.set(0, 0, 1).applyQuaternion(fingerWorldQuat);
        const signed = Math.atan2(
          fingerHingeWorld.dot(tmpC.crossVectors(fingerEnd, fingerDesired)),
          fingerEnd.dot(fingerDesired),
        );
        const bend = THREE.MathUtils.clamp(
          finger.angles[joint] + THREE.MathUtils.clamp(signed, -0.7, 0.7),
          0,
          index === 0 ? THREE.MathUtils.degToRad(115) : maxFingerFlex,
        );
        finger.angles[joint] = bend;
        bone.quaternion
          .copy(finger.rest[joint])
          .multiply(
            fingerRotation.setFromAxisAngle(
              axis.set(0, 0, 1),
              bend * flexWeight,
            ),
          );
      }
    const knuckle = finger.joints[0];
    knuckle.updateWorldMatrix(true, true);
    knuckle.getWorldPosition(fingerBase);
    finger.joints[2].getWorldPosition(fingerEnd);
    fingerEnd.sub(fingerBase).normalize();
    fingerDesired.copy(finger.target).sub(fingerBase).normalize();
    axis.crossVectors(fingerEnd, fingerDesired);
    if (axis.lengthSq() > 1e-6) {
      const angle =
        Math.min(
          index === 0 || index === 3 ? 0.65 : 0.3,
          Math.atan2(axis.length(), fingerEnd.dot(fingerDesired)),
        ) * flexWeight;
      knuckle.parent!.getWorldQuaternion(fingerWorldQuat).invert();
      axis.normalize().applyQuaternion(fingerWorldQuat);
      knuckle.quaternion.premultiply(
        fingerRotation.setFromAxisAngle(axis, angle),
      );
    }
  }
}
const color = (hex: number) => new THREE.MeshToonMaterial({ color: hex });

function solveArm(
  shoulder: THREE.Bone,
  elbow: THREE.Bone,
  hand: THREE.Bone,
  target: THREE.Object3D,
  weight: number,
) {
  target.getWorldPosition(tmpC);
  for (let i = 0; i < 22; i++) {
    for (const joint of [elbow, shoulder]) {
      joint.updateWorldMatrix(true, true);
      joint.getWorldPosition(tmpA);
      hand.getWorldPosition(tmpB);
      const toHand = tmpB.sub(tmpA).normalize();
      const toTarget = tmpD.copy(tmpC).sub(tmpA).normalize();
      if (toHand.lengthSq() < 1e-8 || toTarget.lengthSq() < 1e-8) continue;
      const angle = Math.acos(
        THREE.MathUtils.clamp(toHand.dot(toTarget), -1, 1),
      );
      if (angle < 0.0001) continue;
      axis.crossVectors(toHand, toTarget).normalize();
      if (axis.lengthSq() < 1e-8) continue;
      joint.parent!.getWorldQuaternion(q).invert();
      axis.applyQuaternion(q);
      joint.quaternion.premultiply(
        turn.setFromAxisAngle(axis, Math.min(angle, 0.6) * weight),
      );
    }
  }
  hand.updateWorldMatrix(true, false);
  return hand.getWorldPosition(tmpA).distanceTo(tmpC);
}

function steerElbow(
  [shoulder, elbow, hand]: Arm,
  target: THREE.Object3D,
  hint: THREE.Vector3,
  weight = 1,
) {
  shoulder.updateWorldMatrix(true, true);
  const shoulderWorld = shoulder.getWorldPosition(tmpA);
  const elbowWorld = elbow.getWorldPosition(tmpB);
  target.getWorldPosition(tmpC);
  armAxis.subVectors(tmpC, shoulderWorld).normalize();
  elbowRadial.subVectors(elbowWorld, shoulderWorld);
  elbowRadial.addScaledVector(armAxis, -elbowRadial.dot(armAxis)).normalize();
  poleRadial.subVectors(hint, shoulderWorld);
  poleRadial.addScaledVector(armAxis, -poleRadial.dot(armAxis)).normalize();
  if (elbowRadial.lengthSq() > 1e-5 && poleRadial.lengthSq() > 1e-5) {
    const signed = Math.atan2(
      cross.crossVectors(elbowRadial, poleRadial).dot(armAxis),
      elbowRadial.dot(poleRadial),
    );
    shoulder.parent!.getWorldQuaternion(q).invert();
    shoulder.quaternion.premultiply(
      turn.setFromAxisAngle(armAxis.applyQuaternion(q), signed * weight),
    );
    elbow.updateWorldMatrix(true, true);
    const elbowPosition = elbow.getWorldPosition(tmpA);
    hand.getWorldPosition(tmpB);
    target.getWorldPosition(tmpC);
    const current = tmpB.sub(elbowPosition).normalize();
    const desired = tmpC.sub(elbowPosition).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(current.dot(desired), -1, 1));
    if (angle > 1e-5) {
      cross.crossVectors(current, desired).normalize();
      elbow.parent!.getWorldQuaternion(q).invert();
      elbow.quaternion.premultiply(
        turn.setFromAxisAngle(cross.applyQuaternion(q), Math.min(angle, 1.0)),
      );
    }
  }
}
function finishWrist(hand: THREE.Bone, target: THREE.Object3D) {
  target.getWorldPosition(tmpC);
  hand.getWorldPosition(tmpA);
  hand.parent!.worldToLocal(tmpB.copy(tmpC));
  hand.position.add(
    tmpB
      .sub(hand.parent!.worldToLocal(tmpA))
      .clampLength(0, 0.025 / hand.getWorldScale(axis).x),
  );
  hand.updateWorldMatrix(true, false);
  return hand.getWorldPosition(tmpA).distanceTo(tmpC);
}

function reachArm(
  [upper, fore, hand]: Arm,
  goal: THREE.Vector3,
  hint: THREE.Vector3,
) {
  upper.getWorldPosition(reachShoulder);
  const a = reachShoulder.distanceTo(fore.getWorldPosition(reachElbow)),
    b = reachElbow.distanceTo(hand.getWorldPosition(reachWrist));
  reachAxis.subVectors(goal, reachShoulder);
  const d = THREE.MathUtils.clamp(
    reachAxis.length(),
    Math.abs(a - b) + 1e-6,
    a + b - 1e-6,
  );
  reachAxis.normalize();
  reachBend.subVectors(hint, reachShoulder);
  reachBend.addScaledVector(reachAxis, -reachBend.dot(reachAxis)).normalize();
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  reachElbow
    .copy(reachShoulder)
    .addScaledVector(reachAxis, a * cos)
    .addScaledVector(reachBend, a * Math.sqrt(Math.max(0, 1 - cos * cos)));
  aimBone(
    upper,
    fore,
    reachAim.subVectors(reachElbow, reachShoulder).normalize(),
    1,
  );
  aimBone(
    fore,
    hand,
    reachAim.subVectors(goal, fore.getWorldPosition(reachElbow)).normalize(),
    1,
  );
}

const throughKeys = [0, 0.5, 1];
const throughValues = [0, 0, 0];
function through(a: number, b: number, c: number, u: number, at: number) {
  throughKeys[1] = at;
  throughValues[0] = a;
  throughValues[1] = b;
  throughValues[2] = c;
  return pchip(throughKeys, throughValues, u);
}

function restorePositions(loaded: Loaded) {
  for (let index = 0; index < loaded.skeleton.length; index++) {
    loaded.skeleton[index].position.copy(loaded.restPositions[index]);
    loaded.skeleton[index].scale.copy(loaded.restScales[index]);
  }
}

function armChain(
  bones: THREE.Bone[],
  side: "Left" | "Right",
  leg = false,
): Arm | null {
  const pick = (suffix: string) =>
    bones.find((b) => norm(b.name) === `${side.toLowerCase()}${suffix}`);
  const shoulder = pick(leg ? "upleg" : "arm"),
    elbow = pick(leg ? "leg" : "forearm"),
    hand = pick(leg ? "foot" : "hand");
  return shoulder && elbow && hand ? [shoulder, elbow, hand] : null;
}

async function spriteDecal(
  root: THREE.Object3D,
  id: string,
): Promise<SpriteDecal> {
  const map = await new THREE.TextureLoader().loadAsync(
    `/avatars/${encodeURIComponent(id)}/peek-body.webp`,
  );

  map.colorSpace = THREE.NoColorSpace;

  const { width, height } = map.image as HTMLImageElement;
  const mix = { value: 0 };
  const meshes: SpriteDecal["meshes"] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const skinIndex = node.geometry.getAttribute("skinIndex"),
      skinWeight = node.geometry.getAttribute("skinWeight");
    const count = node.geometry.getAttribute("position").count;
    const uv = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    for (let index = 0; index < count; index++) {
      let strongest = -1,
        dominant = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = skinWeight.getComponent(index, slot);
        if (weight > strongest) {
          strongest = weight;
          dominant = skinIndex.getComponent(index, slot);
        }
      }
      const bone = norm(node.skeleton.bones[dominant].name);
      uv.setZ(
        index,
        HAND_CHAIN.test(bone) ? 0 : HEAD_CHAIN.test(bone) ? 1 : 0.5,
      );
    }
    node.geometry.setAttribute("spriteUv", uv);
    meshes.push({ mesh: node, uv });
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      material.onBeforeCompile = (
        shader: THREE.WebGLProgramParametersWithUniforms,
      ) => {
        shader.uniforms.spriteMap = { value: map };
        shader.uniforms.spriteMix = mix;
        shader.vertexShader = `attribute vec3 spriteUv;\nvarying vec3 vSpriteUv;\n${shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvSpriteUv = spriteUv;")}`;
        const { x, top, bottom, feather } = SPRITE_DECAL;
        shader.fragmentShader = `uniform sampler2D spriteMap;\nuniform float spriteMix;\nvarying vec3 vSpriteUv;\n${shader.fragmentShader.replace(
          "#include <colorspace_fragment>",
          `#include <colorspace_fragment>
          if (spriteMix > 0.0) {
            vec2 px = vSpriteUv.xy;
            float region = smoothstep(0.1, 0.4, vSpriteUv.z) * smoothstep(${(x - feather).toFixed(1)}, ${x.toFixed(1)}, px.x) * smoothstep(${(top - feather).toFixed(1)}, ${top.toFixed(1)}, px.y) * (1.0 - smoothstep(${bottom.toFixed(1)}, ${(bottom + feather).toFixed(1)}, px.y));
            vec4 sprite = texture2D(spriteMap, vec2(px.x / ${width.toFixed(1)}, 1.0 - px.y / ${height.toFixed(1)}));
            float saturation = (max(sprite.r, max(sprite.g, sprite.b)) - min(sprite.r, min(sprite.g, sprite.b))) / max(max(sprite.r, max(sprite.g, sprite.b)), 1e-3);
            float take = mix(1.0 - smoothstep(0.12, 0.22, saturation), 1.0, smoothstep(0.6, 0.9, vSpriteUv.z));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, sprite.rgb, spriteMix * region * take * smoothstep(0.5, 0.95, sprite.a));
          }`,
        )}`;
      };
      material.customProgramCacheKey = () => "peek-sprite-decal";
    }
  });
  return { map, mix, meshes };
}

function fixtureGuitar(id: string) {
  const body = new THREE.Group();
  body.name = "fixture";
  const tiger = id === "dev-michelle";
  const lacquer = color(tiger ? 0xb88432 : 0x327fa4);
  const neck = color(tiger ? 0x4c281e : 0x745545);
  const box = (
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    body.add(mesh);
  };
  box(tiger ? 0.4 : 0.36, tiger ? 0.46 : 0.38, 0.085, lacquer, 0, -0.08, 0.12);
  box(0.6, 0.055, 0.055, neck, 0.33, 0.09, 0.12);
  if (tiger)
    for (let i = 0; i < 4; i++)
      box(0.39, 0.016, 0.09, neck, 0, -0.21 + i * 0.08, 0.17);
  const gripNeck = new THREE.Object3D();
  gripNeck.name = "gripNeck";
  gripNeck.position.set(0.39, 0.1, 0.16);
  body.add(gripNeck);
  const gripStrum = new THREE.Object3D();
  gripStrum.name = "gripStrum";
  gripStrum.position.set(-0.035, -0.02, 0.18);
  body.add(gripStrum);
  return body;
}

function fixtureStrum(skeleton: THREE.Bone[], bpm: number) {
  const tracks: THREE.KeyframeTrack[] = [];
  const times = [0, 0.14, 0.27, 0.41, 0.55];
  const pose = {
    rightarm: [0.12, 0.2, 0.12, 0.03, 0.12],
    rightforearm: [-0.2, 0.18, -0.2, 0.18, -0.2],
    leftarm: [-0.2, -0.22, -0.2, -0.22, -0.2],
    spine: [0, 0.025, 0, -0.025, 0],
  };
  for (const [part, angles] of Object.entries(pose)) {
    const bone = skeleton.find((node) => norm(node.name) === part);
    if (!bone) continue;
    const base = bone.quaternion.clone();
    const axis = part.endsWith("arm")
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0);
    const values = angles.flatMap((angle) =>
      base
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle))
        .toArray(),
    );
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${bone.name}.quaternion`,
        times,
        values,
      ),
    );
  }

  const keyed = new Set(tracks.map((track) => track.name));
  for (const bone of skeleton) {
    if (!keyed.has(`${bone.name}.quaternion`))
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${bone.name}.quaternion`,
          [0],
          bone.quaternion.toArray(),
        ),
      );
    if (norm(bone.name) === "hips")
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${bone.name}.position`,
          [0],
          bone.position.toArray(),
        ),
      );
  }
  return new THREE.AnimationClip("strum", 60 / bpm, tracks);
}

const HOP_SIT = "hop-sit-bob";
const HOP_SIT_SOURCE = "bob";
const ROOT_Z = 0.64;

const GUITAR_DURATION = 0.5;

export class StageEngine {
  readonly ids: string[] = [];
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    -0.85,
    0.85,
    1.1,
    -1.1,
    0.01,
    30,
  );
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private loaded: Loaded | null = null;
  private decal: SpriteDecal | null = null;
  private loading: Promise<void> | null = null;
  private state: StageState = "peek";
  private index = 0;
  private bpm = 110;
  private clipBpm = 110;
  private clipBpms: Record<string, number> = {};
  private approvedClips = new Set<string>();
  private elapsed = 0;
  private scrubHoldUntil = 0;
  private guitarScale = 1;
  private demoCameraDegrees = 0;
  private hopSitHipTakeoffY = 0;

  private hopSitDeepHipX = 0;
  private hopSitPushTravel = 0;
  private hopSitContactHipHeight = 0;
  private hopSitLandedY = 0;

  private hopSitFall = 0;

  private strumYaw = 0;

  private profileYaw = -Math.PI / 2;
  private readonly peekRootPosition = new THREE.Vector3();
  private readonly peekRootScale = new THREE.Vector3();

  private readonly peekHips = new THREE.Vector3();

  private readonly pushOffset = new THREE.Vector3();

  private readonly peekArms = [
    [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
    [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
  ] as const;
  private hopSitRestPose: Promise<RestPose> | null = null;
  private hopSitTime = 0;

  private readonly contactToes = [
    new THREE.Vector3(),
    new THREE.Vector3(),
  ] as const;

  private legs: [Arm | null, Arm | null] = [null, null];

  private footRest: [number, number] = [0, 0];

  private chestTwist: THREE.Bone[] = [];
  private headTwist: THREE.Bone[] = [];

  private readonly pulseSaved: {
    bone: THREE.Bone;
    quaternion: THREE.Quaternion;
    position: THREE.Vector3;
  }[] = [];
  private pulsed = false;
  private readonly standToes = [
    new THREE.Vector3(),
    new THREE.Vector3(),
  ] as const;

  private readonly strumStance = [
    new THREE.Vector3(),
    new THREE.Vector3(),
  ] as const;
  private readonly strumLegs = [
    [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
    [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
  ] as const;

  private readonly hopSitTakeoffRoot = new THREE.Vector3();
  private readonly hopSitContactRoot = new THREE.Vector3();
  private guitarTime = 0;
  private armArrival = 0;

  private readonly guitarCentre = new THREE.Vector3();
  private readonly guitarOrigin = new THREE.Vector3();
  private readonly guitarBaseRotation = new THREE.Quaternion();
  private readonly strumGripOffset = new THREE.Vector3();

  private readonly exitGuitarPosition = new THREE.Vector3();
  private readonly exitGuitarRotation = new THREE.Quaternion();

  private pulling = false;
  private readonly handOnGuitar = new THREE.Matrix4();
  private readonly leftHandOnGuitar = new THREE.Matrix4();
  private readonly guitarOnHand = new THREE.Matrix4();
  private pullBones: [THREE.Bone[], THREE.Bone[]] = [[], []];
  private pullHang: [THREE.Quaternion[], THREE.Quaternion[]] = [[], []];
  private pullClip: [THREE.Quaternion[], THREE.Quaternion[]] = [[], []];
  private pullShoulders: [THREE.Bone | null, THREE.Bone | null] = [null, null];
  private readonly pullShoulderHang: [THREE.Quaternion, THREE.Quaternion] = [
    new THREE.Quaternion(),
    new THREE.Quaternion(),
  ];
  private readonly pullHeld = new Set<THREE.Bone>();

  private readonly pullThumb = new Set<THREE.Bone>();

  private readonly pullHangWrist: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private readonly pullHangElbow: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private readonly pullHangHand: [THREE.Quaternion, THREE.Quaternion] = [
    new THREE.Quaternion(),
    new THREE.Quaternion(),
  ];
  private strumStart = 0;
  private musicPending = false;

  private pauseIdleBlend = 0;
  private pauseIdleTime = 0;

  private trackChangeActive = false;
  private trackChangeFrozen = false;
  private trackChangeElapsed = 0;
  private trackChangeFinish: number = TRACK_CHANGE.finishMin;
  private trackChangeBlend = 0;

  private readonly spriteTilt = { angle: 0, rise: 0 };

  private readonly hupHead = new THREE.Vector3();

  private exiting = false;
  private exitTime = 0;

  private exitFrom: THREE.Quaternion[] = [];
  private exitTo: THREE.Quaternion[] = [];
  private exitX = 0;

  private exitLift = 0;
  private exitStance = -1;
  private readonly exitFeet: [ExitFoot, ExitFoot] = [
    { heel: 0, ball: 0, shift: 0, low: 0 },
    { heel: 0, ball: 0, shift: 0, low: 0 },
  ];

  private readonly exitTrail = new THREE.Vector3();
  private exitHold = 1;
  private exitHeldFor = 0;
  private exitBent = 0;

  private exitFirst = true;
  private readonly exitHead = { yaw: 0, pitch: 0 };
  private exitDone: (() => void) | null = null;

  private handingOff = false;
  private showingSprite = true;
  private firstHopFrame: (() => void) | null = null;
  private frame = 0;
  private visible = true;
  private disposed = false;
  private distance: [number, number] = [0, 0];
  private audio: AudioContext | null = null;

  private readonly trackAudio: HTMLAudioElement[] = [];
  private tracksPreparation: Promise<void> | null = null;
  private rejectTracksPreparation: ((reason: Error) => void) | null = null;
  private preparationVersion = 0;
  private preparationTimeout: number | undefined;
  private audioElement: HTMLAudioElement | null = null;
  private audioGeneration = 0;

  private audioElementGeneration = -1;
  private audioPlayAttempt = 0;

  private audioPlayRequested = false;
  private trackIndex = 0;
  private paused = false;
  private musicError = false;
  private beatTimer = 0;
  private nextBeat = 0;
  private beatOrigin = 0;
  private observer: IntersectionObserver;
  private lastReport = 0;
  private op = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;

  setDemoMode(on: boolean) {
    this.demo = on;

    const debug = window as Window & {
      __stage?: StageEngine;
      __THREE?: typeof THREE;
    };
    if (on) Object.assign(debug, { __stage: this, __THREE: THREE });
    else {
      this.demoCameraDegrees = 0;
      if (debug.__stage === this) {
        delete debug.__stage;
        delete debug.__THREE;
      }
    }
  }
  setReduced(on: boolean) {
    this.reduced = on;
  }
  setDemoCamera(degrees: number) {
    if (this.demo)
      this.demoCameraDegrees = THREE.MathUtils.clamp(degrees, -90, 90);
  }
  constructor(
    canvas: HTMLCanvasElement,
    private host: HTMLElement,
    private report: (snapshot: StageSnapshot) => void,
    private demo: boolean,
    private reduced: boolean,
  ) {
    if (demo) Object.assign(window, { __stage: this, __THREE: THREE });
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setClearAlpha(0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.camera.position.set(0, 0.54, 5);
    this.camera.lookAt(0, 0.54, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff5e9, 0x798695, 2.2));
    const key = new THREE.DirectionalLight(0xfff5e6, 2.2);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc0dae9, 1.4);
    rim.position.set(1, 2, -2);
    this.scene.add(rim);
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.resume();
    });
    this.observer.observe(host);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }
  async init(_id?: string) {
    this.ids.push("bob");
    const manifest = await fetch("/avatars/clips/clips.json");
    if (
      manifest.ok &&
      manifest.headers.get("content-type")?.includes("application/json")
    ) {
      const clips = (await manifest.json()) as Record<
        string,
        { bpm?: number; approved?: boolean }
      >;
      this.clipBpms = Object.fromEntries(
        Object.entries(clips)
          .filter(
            (entry): entry is [string, { bpm: number; approved?: boolean }] =>
              Number.isFinite(entry[1]?.bpm) && (entry[1]?.bpm ?? 0) > 0,
          )
          .map(([key, value]) => [key, value.bpm]),
      );
      this.approvedClips = new Set(
        Object.entries(clips)
          .filter(([, value]) => value?.approved === true)
          .map(([key]) => key),
      );
    }
    await this.select("bob");
  }

  private async load(id: string, hopOnLoad = false) {
    const ticket = ++this.op;
    const response = await fetch(`/avatars/${id}/avatar.json`);
    if (!response.ok)
      throw new Error(`Avatar ${id} metadata: HTTP ${response.status}`);

    const metadata = (await response.json()) as Metadata;
    const gltf = await loader.loadAsync(`/avatars/${id}/avatar.glb`);
    if (this.disposed || ticket !== this.op) return;
    this.cleanup();
    const root = gltf.scene;
    const { skeleton, leftFoot, rightFoot, leftToe, rightToe } =
      normalizeAvatar(root, id);
    const footRest = [leftToe, rightToe].map((toe) => {
      const foot = toe.parent!,
        knee = foot.parent!;
      const ankle = foot.getWorldPosition(new THREE.Vector3());
      return Math.acos(
        THREE.MathUtils.clamp(
          ankle
            .clone()
            .sub(knee.getWorldPosition(tmpA))
            .normalize()
            .dot(toe.getWorldPosition(tmpB).sub(ankle).normalize()),
          -1,
          1,
        ),
      );
    });
    const decal = await spriteDecal(root, id);
    if (this.disposed || ticket !== this.op) {
      decal.map.dispose();
      return;
    }
    const find = (name: string) =>
      skeleton.find((b) => norm(b.name) === name.toLowerCase());
    const toeRest = Math.min(
      leftToe.getWorldPosition(tmpA).y,
      rightToe.getWorldPosition(tmpB).y,
    );

    const heel = (foot: THREE.Bone) => ({
      foot,
      local: foot.worldToLocal(
        foot.getWorldPosition(new THREE.Vector3()).setY(toeRest),
      ),
    });
    const heels: Loaded["heels"] = [heel(leftFoot), heel(rightFoot)];
    const mixer = new THREE.AnimationMixer(root);
    const authoredKey = `strum-${id}`;
    const authoredBpm = this.clipBpms[authoredKey];
    const authoredStrum = !!authoredBpm && this.approvedClips.has(authoredKey);
    const hopSitBase = `/avatars/clips/${HOP_SIT}`;
    const [strumAnimation, metadataResponse, hopAnimation, rest] =
      await Promise.all([
        authoredStrum
          ? loader
              .loadAsync(`/avatars/clips/${authoredKey}.glb`)
              .then((gltf) => gltf.animations[0])
          : fixtureStrum(skeleton, this.clipBpm),
        fetch(`${hopSitBase}.json`),
        loader
          .loadAsync(`${hopSitBase}.glb`)
          .then((gltf) => gltf.animations[0]),
        this.hopSitRest(),
      ]);
    if (this.disposed || ticket !== this.op) return;
    if (!strumAnimation?.tracks.length)
      throw new Error(`Strum clip for ${id} has no tracks`);
    const retargetNames = (animation: THREE.AnimationClip) => {
      for (const track of animation.tracks) {
        const separator = track.name.indexOf(".");
        const bone = skeleton.find(
          (candidate) =>
            norm(candidate.name) === norm(track.name.slice(0, separator)),
        );
        if (bone) track.name = bone.name + track.name.slice(separator);
      }
    };
    if (authoredStrum) retargetNames(strumAnimation);
    const strum = mixer.clipAction(strumAnimation);
    strum.setLoop(THREE.LoopRepeat, Infinity);
    if (!metadataResponse.ok)
      throw new Error(`HopSit metadata: HTTP ${metadataResponse.status}`);

    const hopSitPhases = (await metadataResponse.json()) as HopSitPhases;
    if (!(
      hopSitPhases.pullOut > 0 &&
      hopSitPhases.pushStart >= hopSitPhases.pullOut &&
      hopSitPhases.takeoff > hopSitPhases.pushStart &&
      hopSitPhases.fallHoldStart >= hopSitPhases.takeoff &&
      hopSitPhases.fallHoldEnd > hopSitPhases.fallHoldStart &&
      hopSitPhases.contact > hopSitPhases.fallHoldEnd &&
      hopSitPhases.turnStart >= hopSitPhases.contact &&
      hopSitPhases.turnEnd > hopSitPhases.turnStart &&
      hopSitPhases.settled >= hopSitPhases.turnEnd
    ))
      throw new Error("HopSit metadata has unordered phase markers");
    if (!hopAnimation?.tracks.length)
      throw new Error("HopSit clip has no tracks");

    if (id === HOP_SIT_SOURCE) retargetNames(hopAnimation);
    const hopClip =
      id === HOP_SIT_SOURCE
        ? hopAnimation
        : retargetClip(hopAnimation, rest, skeleton);
    const hopSit = mixer.clipAction(hopClip);
    const hopSitTracks = hopClip.tracks.flatMap((track): HopTrack[] => {
      const separator = track.name.lastIndexOf(".");
      const property = track.name.slice(separator + 1);
      const bone = skeleton.find(
        (candidate) => candidate.name === track.name.slice(0, separator),
      );
      if (!bone) return [];
      if (property === "quaternion")
        return [
          {
            bone,
            property,
            interpolant: new THREE.QuaternionLinearInterpolant(
              track.times,
              track.values,
              4,
              new Float32Array(4),
            ),
          },
        ];
      return property === "position"
        ? [
            {
              bone,
              property,
              interpolant: new THREE.LinearInterpolant(
                track.times,
                track.values,
                3,
                new Float32Array(3),
              ),
            },
          ]
        : [];
    });
    hopSit.setLoop(THREE.LoopOnce, 1);
    hopSit.clampWhenFinished = true;
    let prop: THREE.Object3D | null = null;
    try {
      prop = (await loader.loadAsync(metadata.guitar.src)).scene;
    } catch (error) {
      if (!this.demo || !id.startsWith("dev-")) throw error;
      prop = fixtureGuitar(id);
    }
    if (this.disposed || ticket !== this.op) return;
    const spine = find("Spine2") || find("Spine1") || find("Spine");
    let targets: Loaded["targets"] = null;
    if (spine && prop) {
      spine.add(prop);
      prop.position.fromArray(metadata.guitar.position);
      prop.rotation.set(...metadata.guitar.rotation);

      spine.updateWorldMatrix(true, false);
      spine.getWorldScale(tmpA);
      prop.scale.setScalar(1 / tmpA.x);
      const gripNeck = prop.getObjectByName("gripNeck");
      const gripStrum = prop.getObjectByName("gripStrum");
      this.guitarScale = prop.scale.x;
      this.guitarOrigin.copy(prop.position);
      this.guitarBaseRotation.copy(prop.quaternion);
      prop.updateWorldMatrix(true, true);
      if (gripStrum)
        this.guitarCentre.copy(
          prop.worldToLocal(gripStrum.getWorldPosition(tmpA)),
        );
      if (gripNeck && gripStrum) targets = [gripNeck, gripStrum];
      prop.visible = false;
    }
    this.scene.add(root);

    if (prop) prop.visible = true;
    await this.renderer.compileAsync(this.scene, this.camera);
    if (prop) prop.visible = false;
    if (this.disposed || ticket !== this.op) return;
    const leftArm = armChain(skeleton, "Left"),
      rightArm = armChain(skeleton, "Right");
    const fingers: Finger[] = [];
    const fretting: FrettingFinger[] = [];
    for (const side of ["left", "right"] as const)
      for (const digit of [
        "thumb",
        "index",
        "middle",
        "ring",
        "pinky",
      ] as const)
        for (let joint = 1; joint <= 3; joint++) {
          const bone = skeleton.find(
            (candidate) =>
              norm(candidate.name) === `${side}hand${digit}${joint}`,
          );
          if (!bone) continue;
          const curl = THREE.MathUtils.degToRad(
            digit === "thumb"
              ? 24
              : digit === "index"
                ? 42
                : digit === "middle"
                  ? 36
                  : digit === "ring"
                    ? 38
                    : 42,
          );
          if (side === "right")
            fingers.push({
              bone,
              rest: bone.quaternion.clone(),
              curl,
              splay:
                digit === "thumb" && joint === 1
                  ? -0.18
                  : digit === "pinky" && joint === 1
                    ? -0.08
                    : 0,
              left: false,
            });
        }
    for (const digit of ["index", "middle", "ring", "pinky"] as const) {
      const joints = [1, 2, 3].map((joint) =>
        skeleton.find((bone) => norm(bone.name) === `lefthand${digit}${joint}`),
      );
      if (joints.every(Boolean)) {
        const chain = joints as [THREE.Bone, THREE.Bone, THREE.Bone];
        fretting.push({
          joints: chain,
          rest: [
            chain[0].quaternion.clone(),
            chain[1].quaternion.clone(),
            chain[2].quaternion.clone(),
          ],
          angles: [0, 0, 0],
          target: new THREE.Vector3(),
        });
      }
    }
    const thumbBones = [1, 2, 3].map((joint) =>
      skeleton.find((bone) => norm(bone.name) === `lefthandthumb${joint}`),
    );

    const thumb = thumbBones.every(Boolean)
      ? (thumbBones as [THREE.Bone, THREE.Bone, THREE.Bone])
      : null;
    const pickIndex =
      skeleton.find((bone) => norm(bone.name) === "righthandindex3") || null;
    const head = find("Head"),
      hips = find("Hips");
    if (!head || !hips)
      throw new Error(`Avatar ${id} is missing the Mixamo head or hips bone`);

    const headCentre = head.worldToLocal(
      head
        .getWorldPosition(tmpA)
        .add(tmpB.set(0, (1 - tmpA.y) / 2, 0))
        .clone(),
    );
    const peekPose = await this.loadPeekPose(id, skeleton);
    if (this.disposed || ticket !== this.op) return;
    this.loaded = {
      root,
      facing: root.rotation.y,
      baseScale: root.scale.clone(),
      skeleton,
      metadata,
      mixer,
      strum,
      hopSit,
      hopSitTracks,
      hopSitPhases,
      toes: [leftToe, rightToe],
      heels,
      toeRest,
      hips,
      head,
      headCentre,
      peekPose,
      authoredStrum,
      strumBpm: authoredStrum ? authoredBpm : this.clipBpm,
      prop,
      targets,
      arms: leftArm && rightArm ? [leftArm, rightArm] : null,
      restPositions: skeleton.map((bone) => bone.position.clone()),
      restScales: skeleton.map((bone) => bone.scale.clone()),
      wristRest:
        leftArm && rightArm
          ? [leftArm[2].position.clone(), rightArm[2].position.clone()]
          : null,
      wristRotation:
        leftArm && rightArm
          ? [leftArm[2].quaternion.clone(), rightArm[2].quaternion.clone()]
          : null,
      fingers,
      fretting,
      thumb,
      thumbRest: thumb?.map((bone) => bone.quaternion.clone()) ?? [],
      pickIndex,
    };
    this.decal = decal;
    this.legs = [
      armChain(skeleton, "Left", true),
      armChain(skeleton, "Right", true),
    ];
    this.footRest = [footRest[0], footRest[1]];
    const chain = (names: string[]) =>
      names.flatMap(
        (name) => skeleton.find((bone) => norm(bone.name) === name) ?? [],
      );
    this.chestTwist = chain(["spine", "spine1", "spine2"]);
    this.headTwist = chain(["neck", "head"]);

    const pullArm = (arm: Arm | null) => {
      const bones: THREE.Bone[] = [];
      if (arm) {
        bones.push(arm[0], arm[1]);
        arm[2].traverse((bone) => {
          if (bone instanceof THREE.Bone) bones.push(bone);
        });
      }
      return bones;
    };
    this.pullBones = [pullArm(leftArm), pullArm(rightArm)];
    this.pullShoulders = [
      leftArm?.[0].parent instanceof THREE.Bone ? leftArm[0].parent : null,
      rightArm?.[0].parent instanceof THREE.Bone ? rightArm[0].parent : null,
    ];
    this.pullHang = [
      this.pullBones[0].map(() => new THREE.Quaternion()),
      this.pullBones[1].map(() => new THREE.Quaternion()),
    ];
    this.pullClip = [
      this.pullBones[0].map(() => new THREE.Quaternion()),
      this.pullBones[1].map(() => new THREE.Quaternion()),
    ];
    const pullShoulders = this.pullShoulders.flatMap((bone) => bone ?? []);
    this.pullHeld.clear();
    this.pullThumb.clear();
    for (const bone of this.pullBones[0])
      if (norm(bone.name).includes("thumb")) this.pullThumb.add(bone);
    for (const bone of [...pullShoulders, ...this.pullBones.flat()])
      this.pullHeld.add(bone);

    this.pulseSaved.length = 0;
    this.pulsed = false;
    for (const bone of [
      hips,
      ...this.chestTwist.slice(-1),
      ...this.headTwist,
      ...this.legs.flatMap((leg) => leg ?? []),
      ...pullShoulders,
      ...this.pullBones.flat(),
    ])
      this.pulseSaved.push({
        bone,
        quaternion: new THREE.Quaternion(),
        position: new THREE.Vector3(),
      });

    strum.play();
    mixer.update(0);
    this.hipsAboveRoot(this.loaded);

    if (prop && leftArm && rightArm) {
      root.updateWorldMatrix(true, true);
      this.handOnGuitar
        .copy(prop.matrixWorld)
        .invert()
        .multiply(rightArm[2].matrixWorld);
      this.leftHandOnGuitar
        .copy(prop.matrixWorld)
        .invert()
        .multiply(leftArm[2].matrixWorld);
      this.guitarOnHand.copy(this.handOnGuitar).invert();
    }
    const chest = tmpD
      .set(0, 0, 1)
      .transformDirection((spine ?? hips).matrixWorld);
    this.strumYaw = -Math.atan2(chest.x, chest.z);
    this.profileYaw = this.strumYaw - Math.PI / 2;
    strum.stop();

    const rootPosition = root.position.clone(),
      rootQuaternion = root.quaternion.clone();
    this.poseHop(this.loaded, hopSitPhases.settled);
    root.position.set(0, 0, ROOT_Z);
    this.yawQuaternion(this.loaded, this.strumYaw, root.quaternion);
    root.updateWorldMatrix(true, true);
    for (let side = 0; side < 2; side++) {
      root.worldToLocal(
        this.loaded.toes[side].getWorldPosition(this.strumStance[side]),
      );
      this.legs[side]?.forEach((bone, index) =>
        this.strumLegs[side][index].copy(bone.quaternion),
      );
    }
    root.position.copy(rootPosition);
    root.quaternion.copy(rootQuaternion);
    root.updateWorldMatrix(true, true);
    if (this.demo) {
      this.host.dataset.strumSource = authoredStrum ? authoredKey : "fallback";
      this.host.dataset.strumClipBpm = String(this.loaded.strumBpm);
    }
    this.bpm = metadata.tracks?.length
      ? this.loaded.strumBpm
      : metadata.track?.bpm || this.loaded.strumBpm;
    this.enter("peek");
    if (hopOnLoad) this.enter("hop");
    this.reportNow();
    this.resume();
  }

  select(id: string, hopOnLoad = false): Promise<void> {
    const next = this.ids.indexOf(id);
    if (next < 0) return Promise.resolve();
    if (this.loading && this.index === next) return this.loading;
    if (this.loaded?.metadata.id === id) return Promise.resolve();
    this.stopMusic();
    this.index = next;
    const loading = this.load(id, hopOnLoad);
    this.loading = loading;
    void loading.then(
      () => {
        if (this.loading === loading) this.loading = null;
      },
      () => {
        if (this.loading === loading) this.loading = null;
      },
    );
    return loading;
  }

  private enter(state: StageState) {
    const loaded = this.loaded;
    if (!loaded) return;
    const before = this.state;
    this.state = state;
    this.elapsed = 0;
    this.exiting = false;
    this.exitDone = null;
    this.handingOff = false;
    this.pulling = false;
    this.musicPending = false;
    if (state !== "strum") {
      this.pauseIdleBlend = 0;
      this.pauseIdleTime = 0;
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.trackChangeBlend = 0;
    }
    const fromHop = state === "strum" && before === "hop";
    if (
      state === "strum" &&
      !loaded.authoredStrum &&
      loaded.wristRotation &&
      loaded.arms
    ) {
      loaded.arms[0][2].quaternion.copy(loaded.wristRotation[0]);
      loaded.arms[1][2].quaternion.copy(loaded.wristRotation[1]);
      for (const finger of loaded.fingers)
        finger.bone.quaternion.copy(finger.rest);
      for (const finger of loaded.fretting)
        for (let joint = 0; joint < 3; joint++)
          finger.joints[joint].quaternion.copy(finger.rest[joint]);
      if (loaded.thumb)
        for (let joint = 0; joint < 3; joint++)
          loaded.thumb[joint].quaternion.copy(loaded.thumbRest[joint]);
    }
    if (state !== "strum" && loaded.arms && loaded.wristRest) {
      loaded.arms[0][2].position.copy(loaded.wristRest[0]);
      loaded.arms[1][2].position.copy(loaded.wristRest[1]);
      if (loaded.wristRotation) {
        loaded.arms[0][2].quaternion.copy(loaded.wristRotation[0]);
        loaded.arms[1][2].quaternion.copy(loaded.wristRotation[1]);
      }
    }
    if (this.demo)
      this.host.dataset.guitarVisible =
        state === "strum" && loaded.prop ? "1" : "0";
    if (state === "peek") {
      this.stopMusic();
      this.trackIndex = 0;
      this.paused = false;
      this.musicError = false;
      loaded.mixer.stopAllAction();
      if (loaded.prop) loaded.prop.visible = false;
      loaded.root.rotation.set(0, loaded.facing, 0);
    } else if (state === "hop") {
      if (loaded.prop) loaded.prop.visible = false;
      this.hopSitTime = 0;
      loaded.strum.stop();
      loaded.hopSit.reset().play();
      loaded.hopSit.setEffectiveWeight(1);
      this.calibrateHopSit(loaded);
    } else {
      this.pulling =
        fromHop &&
        loaded.authoredStrum &&
        !this.reduced &&
        !!loaded.prop &&
        !!loaded.arms;
      if (this.pulling) {
        for (let side = 0; side < 2; side++) {
          this.pullBones[side].forEach((bone, index) =>
            this.pullHang[side][index].copy(bone.quaternion),
          );
          const shoulder = this.pullShoulders[side];
          if (shoulder) this.pullShoulderHang[side].copy(shoulder.quaternion);
        }
        loaded.root.updateWorldMatrix(true, true);
        loaded.root.getWorldQuaternion(pullRootInverse).invert();
        loaded.arms!.forEach(([upper, fore, hand], side) => {
          upper.getWorldPosition(tmpB);
          this.pullHangWrist[side]
            .subVectors(hand.getWorldPosition(tmpA), tmpB)
            .applyQuaternion(pullRootInverse);
          this.pullHangElbow[side]
            .subVectors(fore.getWorldPosition(tmpA), tmpB)
            .applyQuaternion(pullRootInverse);
          this.pullHangHand[side]
            .copy(pullRootInverse)
            .multiply(hand.getWorldQuaternion(pullPosed));
        });
      }
      this.strumStart = this.pulling ? GUITAR_PULL.strum / GUITAR_PULL.rate : 0;
      if (loaded.prop) {
        loaded.prop.visible = true;
        this.guitarTime =
          loaded.authoredStrum && !this.pulling ? GUITAR_PULL.end : 0;
        this.strumGripOffset.copy(
          loaded.targets?.[1].position || new THREE.Vector3(),
        );
      }
      if (!fromHop) loaded.mixer.stopAllAction();

      restorePositions(loaded);
      const strum = loaded.strum.reset().play();
      strum.setEffectiveTimeScale(
        this.pulling ? 0 : this.bpm / loaded.strumBpm,
      );
      if (fromHop) {
        loaded.hopSit.setEffectiveWeight(1);
        strum.setEffectiveWeight(0);
        this.handingOff = true;
      } else loaded.mixer.update(0);
      this.armArrival = before === "hop" ? 1 : 0;
      this.musicPending = this.pulling;
      this.tick(0);
      if (!this.pulling) this.startMusic();
    }
    this.reportNow();
  }

  hop() {
    if (this.state === "peek") this.enter("hop");
  }
  jump(state: StageState) {
    this.stopMusic();
    this.enter(state);
  }
  showSprite(on: boolean) {
    this.showingSprite = on;
    if (on) {
      this.firstHopFrame = null;
      this.stopMusic();
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.clock.stop();
      if (this.state !== "peek" && this.loaded) this.enter("peek");
    } else this.resume();
  }

  startHop(onFirstFrame: () => void, tilt = { angle: 0, rise: 0 }) {
    if (!this.loaded) return;
    this.spriteTilt.angle = tilt.angle;
    this.spriteTilt.rise = tilt.rise;
    this.firstHopFrame = onFirstFrame;
    this.hop();
    this.showingSprite = false;
    this.resume();
  }

  exit(onDone: () => void) {
    const loaded = this.loaded;
    if (this.exiting) return;
    this.trackChangeActive = false;
    this.trackChangeFrozen = false;
    this.trackChangeElapsed = 0;
    this.stopMusic();
    if (!loaded || this.state !== "strum" || this.reduced) {
      onDone();
      return;
    }
    this.exitTime = 0;
    this.exiting = true;
    this.exitDone = onDone;
    this.handingOff = false;
    this.pulling = false;
    this.musicPending = false;

    this.pulsed = false;
    if (loaded.prop) {
      this.exitGuitarPosition.copy(loaded.prop.position);
      this.exitGuitarRotation.copy(loaded.prop.quaternion);
    }
    const { skeleton } = loaded;
    this.exitFrom = skeleton.map((bone) => bone.quaternion.clone());

    this.exitTo = skeleton.map((bone) => bone.quaternion.clone());
    const at = loaded.hopSitPhases.contact + EXIT.hopPose;
    for (const { bone, property, interpolant } of loaded.hopSitTracks)
      if (property === "quaternion")
        this.exitTo[skeleton.indexOf(bone)].fromArray(interpolant.evaluate(at));
    this.exitX = loaded.root.position.x;
    this.exitLift =
      Math.min(
        loaded.toes[0].getWorldPosition(tmpA).y,
        loaded.toes[1].getWorldPosition(tmpB).y,
      ) -
      this.floorWorldY() -
      loaded.toeRest;
    this.exitStance = -1;
    this.exitFirst = true;
    this.exitHold = 1;
    loaded.head.updateWorldMatrix(true, false);
    const face = tmpD.set(0, 0, 1).transformDirection(loaded.head.matrixWorld);
    this.exitHead.yaw = Math.atan2(face.x, face.z);
    this.exitHead.pitch = Math.asin(THREE.MathUtils.clamp(face.y, -1, 1));
    this.reportNow();
  }
  nextId() {
    return this.ids[(this.index + 1) % this.ids.length];
  }
  skipToSprite() {
    this.showSprite(true);
    this.cleanup();
    const next = this.nextId();
    void this.select(next).catch((error) =>
      console.error("Next avatar failed to load", error),
    );
    return next;
  }
  scrub(position: number) {
    if (this.state !== "hop") this.jump("hop");
    if (this.loaded) {
      const phases = this.loaded.hopSitPhases;
      const total =
        phases.takeoff + this.hopSitFall + phases.settled - phases.contact;
      this.hopSitTime = THREE.MathUtils.clamp(position, 0, 1) * total;
    }
    this.scrubHoldUntil = this.demo
      ? Number.POSITIVE_INFINITY
      : performance.now() + 900;
    this.tick(0);
  }
  freezeFirstHopFrame() {
    if (!this.demo || !this.loaded) return;
    if (this.state !== "hop") this.enter("hop");
    this.hopSitTime = 0;
    this.scrubHoldUntil = Number.POSITIVE_INFINITY;
    this.loaded.hopSit.reset().play();
    this.loaded.mixer.update(0);
    this.tick(0);
    this.reportNow();
  }

  private tracks() {
    return this.loaded?.metadata.tracks ?? [];
  }

  prepareTracks(): Promise<void> {
    if (this.disposed)
      return Promise.reject(new Error("Stage engine was disposed"));
    if (this.tracksPreparation) return this.tracksPreparation;
    const sources = this.tracks().map((track) => track.src);
    if (
      sources.length !== 3 ||
      sources.some(
        (source) =>
          !source.startsWith("/avatars/bob/audio/") || !source.endsWith(".mp3"),
      )
    ) {
      return Promise.reject(
        new Error("Bob requires exactly three local MP3 track sources"),
      );
    }
    this.tracksPreparation = new Promise<void>((resolve, reject) => {
      this.rejectTracksPreparation = reject;
      const version = ++this.preparationVersion;
      this.preparationTimeout = window.setTimeout(() => {
        if (version === this.preparationVersion) {
          this.releasePreparedTracks(
            new Error("Bob's audio took too long to load"),
          );
        }
      }, 45_000);
      const ready = sources.map(
        (source, index) =>
          new Promise<void>((trackReady, trackFailed) => {
            const audio = new Audio();
            audio.preload = "auto";
            audio.volume = 0.4;
            this.trackAudio[index] = audio;
            const current = () =>
              !this.disposed && this.trackAudio[index] === audio;
            const cleanupReadiness = () => {
              audio.removeEventListener("canplay", onCanPlay);
              audio.removeEventListener("error", onPrepareError);
            };
            const onCanPlay = () => {
              if (!current() || audio.readyState < 3) return;
              cleanupReadiness();
              trackReady();
            };
            const onPrepareError = () => {
              if (!current()) return;
              cleanupReadiness();
              trackFailed(
                new Error(`Could not prepare local track: ${source}`),
              );
            };
            audio.addEventListener("canplay", onCanPlay);
            audio.addEventListener("error", onPrepareError);
            audio.addEventListener("ended", () => {
              if (
                current() &&
                audio === this.audioElement &&
                this.audioElementGeneration === this.audioGeneration
              )
                this.nextTrack();
            });
            audio.addEventListener("error", () => {
              if (
                !current() ||
                audio !== this.audioElement ||
                !this.audioPlayRequested
              )
                return;
              this.paused = true;
              this.musicError = true;
              this.syncStrumPlayback();
              this.reportNow();
            });
            audio.src = source;
            audio.load();
            if (audio.readyState >= 3) onCanPlay();
          }),
      );
      void Promise.all(ready).then(
        () => {
          if (this.disposed || version !== this.preparationVersion) return;
          clearTimeout(this.preparationTimeout);
          this.preparationTimeout = undefined;
          this.rejectTracksPreparation = null;
          resolve();
        },
        (error) => {
          if (version === this.preparationVersion)
            this.releasePreparedTracks(error);
        },
      );
    });
    return this.tracksPreparation;
  }

  private playAudio(audio: HTMLAudioElement, generation: number) {
    const attempt = ++this.audioPlayAttempt;
    this.audioPlayRequested = true;
    void audio
      .play()
      .then(() => {
        if (
          generation !== this.audioGeneration ||
          attempt !== this.audioPlayAttempt ||
          audio !== this.audioElement
        )
          return;
        this.musicError = false;
        this.reportNow();
      })
      .catch((error) => {
        if (
          generation !== this.audioGeneration ||
          attempt !== this.audioPlayAttempt ||
          audio !== this.audioElement
        )
          return;
        console.error("Avatar track playback failed", error);
        this.paused = true;
        this.musicError = true;
        this.syncStrumPlayback();
        this.reportNow();
      });
  }

  private startMusic() {
    if (this.trackChangeActive) return;
    const tracks = this.tracks();
    const track = tracks[this.trackIndex];
    const legacyTrack = this.loaded?.metadata.track;
    if (track) {
      const audio = this.trackAudio[this.trackIndex];
      if (!audio) {
        void this.prepareTracks()
          .then(() => {
            if (
              !this.disposed &&
              this.state === "strum" &&
              !this.paused &&
              !this.exiting &&
              this.trackIndex < this.trackAudio.length
            )
              this.startMusic();
          })
          .catch((error) => {
            if (this.disposed) return;
            console.error("Avatar tracks failed to prepare", error);
            this.paused = true;
            this.musicError = true;
            this.syncStrumPlayback();
            this.reportNow();
          });
        return;
      }
      this.stopMusic();
      this.audioElement = audio;
      this.audioElementGeneration = this.audioGeneration;
      audio.currentTime = 0;
      const generation = this.audioGeneration;
      this.beatOrigin = 0;
      if (!this.paused) this.playAudio(audio, generation);
      return;
    }
    if (legacyTrack) {
      this.stopMusic();
      const audio = new Audio(legacyTrack.src);
      audio.loop = true;
      audio.volume = 0.4;
      this.audioElement = audio;
      this.audioElementGeneration = this.audioGeneration;
      const generation = this.audioGeneration;
      this.beatOrigin = 0;
      if (!this.paused) this.playAudio(audio, generation);
      return;
    }

    const context = new AudioContext();
    this.audio = context;
    this.nextBeat = context.currentTime + 0.04;
    this.beatOrigin = this.nextBeat;
    const schedule = () => {
      while (this.nextBeat < context.currentTime + 0.14) {
        for (let string = 0; string < 4; string++) {
          const start = this.nextBeat + string * 0.014;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "triangle";
          oscillator.frequency.value = [164.81, 220, 277.18, 329.63][string];
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.037, start + 0.009);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.27);
        }
        this.nextBeat += 60 / this.bpm;
      }
    };
    schedule();
    this.beatTimer = window.setInterval(schedule, 90);
  }

  private stopMusic() {
    this.audioGeneration++;
    this.audioPlayAttempt++;
    this.audioPlayRequested = false;
    clearInterval(this.beatTimer);
    this.beatTimer = 0;
    this.audioElement?.pause();
    this.audioElement = null;
    this.audioElementGeneration = -1;
    if (this.audio) void this.audio.close();
    this.audio = null;
  }

  private releasePreparedTracks(reason?: Error) {
    this.preparationVersion++;
    clearTimeout(this.preparationTimeout);
    this.preparationTimeout = undefined;
    if (reason && this.rejectTracksPreparation) {
      const reject = this.rejectTracksPreparation;
      this.rejectTracksPreparation = null;
      reject(reason);
    }
    for (const audio of this.trackAudio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    this.trackAudio.length = 0;
    this.audioElement = null;
    this.tracksPreparation = null;
  }

  private syncStrumPlayback() {
    const loaded = this.loaded;
    if (!loaded || this.state !== "strum" || this.exiting || this.pulling)
      return;
    loaded.strum.setEffectiveTimeScale(
      this.paused || this.trackChangeFrozen ? 0 : this.bpm / loaded.strumBpm,
    );
  }

  private changeTrack(offset: number) {
    const count = this.tracks().length;
    if (!count) return;
    this.trackIndex = (this.trackIndex + offset + count) % count;
    this.musicError = false;
    const readyToPlay =
      this.state === "strum" &&
      !this.musicPending &&
      !this.exiting &&
      !this.paused;
    const shouldTransition = readyToPlay && !document.hidden;

    if (shouldTransition) {
      const phase =
        ((((this.loaded!.strum.time * this.loaded!.strumBpm) / 60) % 0.5) +
          0.5) %
        0.5;
      this.trackChangeFinish = THREE.MathUtils.clamp(
        ((0.5 - phase) * 60) / this.loaded!.strumBpm,
        TRACK_CHANGE.finishMin,
        TRACK_CHANGE.finishMax,
      );
    }
    this.stopMusic();
    if (shouldTransition) {
      this.trackChangeActive = true;
      this.trackChangeElapsed = 0;
    } else {
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.syncStrumPlayback();

      if (readyToPlay) this.startMusic();
    }
    this.reportNow();
  }

  previousTrack(): void {
    this.changeTrack(-1);
  }
  nextTrack(): void {
    this.changeTrack(1);
  }
  toggleMusic(): void {
    if (!this.tracks().length) return;
    if (!this.paused) {
      this.paused = true;
      this.audioPlayAttempt++;
      this.audioElement?.pause();
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.syncStrumPlayback();
      this.reportNow();
      return;
    }
    this.paused = false;

    this.trackChangeActive = false;
    this.trackChangeFrozen = false;
    this.trackChangeElapsed = 0;
    if (this.state === "strum" && !this.musicPending && !this.exiting) {
      if (this.musicError || !this.audioElement) this.startMusic();
      else this.playAudio(this.audioElement, this.audioGeneration);
    }
    this.musicError = false;
    this.syncStrumPlayback();
    this.reportNow();
  }

  private readonly onVisibilityChange = () => {
    if (
      document.hidden &&
      this.trackChangeActive &&
      !this.paused &&
      !this.exiting
    ) {
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.trackChangeBlend = 0;
      this.syncStrumPlayback();
      this.startMusic();
    }
    this.resume();
  };
  private readonly resume = () => {
    if (
      this.disposed ||
      this.showingSprite ||
      document.hidden ||
      !this.visible ||
      !this.loaded
    ) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.clock.stop();
      return;
    }
    if (!this.frame) {
      this.clock.start();
      this.frame = requestAnimationFrame(this.draw);
    }
  };

  private readonly draw = () => {
    this.frame = 0;
    if (this.disposed || this.showingSprite || document.hidden || !this.visible)
      return;
    const elapsed = this.clock.getDelta();

    const hanging =
      this.state === "hop" &&
      this.loaded &&
      this.hopSitTime < this.loaded.hopSitPhases.pullOut;
    this.tick(
      Math.min(
        elapsed,
        hanging ? 1 / 30 : this.state === "hop" ? 1 / 15 : 0.05,
      ),
    );
    this.renderer.render(this.scene, this.camera);
    if (this.firstHopFrame && this.state === "hop") {
      const notify = this.firstHopFrame;
      this.firstHopFrame = null;
      notify();
    }
    this.frame = requestAnimationFrame(this.draw);
  };

  private tick(delta: number) {
    const loaded = this.loaded;
    if (!loaded) return;
    this.elapsed += delta;

    if (this.pulsed)
      for (const saved of this.pulseSaved) {
        saved.bone.quaternion.copy(saved.quaternion);
        saved.bone.position.copy(saved.position);
      }
    this.pulsed = false;

    if (this.state !== "hop" && !this.exiting) {
      if (this.handingOff) {
        const handOff = THREE.MathUtils.smoothstep(this.elapsed, 0, HANDOFF);
        loaded.hopSit.setEffectiveWeight(1 - handOff);
        loaded.strum.setEffectiveWeight(handOff);
        this.handingOff = handOff < 1;
      }

      if (
        this.strumStart > 0 &&
        loaded.strum.timeScale === 0 &&
        !this.trackChangeFrozen &&
        (!this.paused || this.pulling)
      ) {
        const since = this.elapsed - this.strumStart,
          ease = GUITAR_PULL.ease / GUITAR_PULL.rate,
          rate = this.bpm / loaded.strumBpm;
        if (since >= ease) {
          loaded.strum.time = rate * (since - ease / 2 - delta);
          loaded.strum.setEffectiveTimeScale(rate);
        } else
          loaded.strum.time =
            since > 0 ? (rate * since * since) / (2 * ease) : 0;
      }
      loaded.mixer.update(delta);
    }
    const head = loaded.skeleton.find((b) => norm(b.name) === "head");
    const beatTime = this.audio
      ? this.audio.currentTime - this.beatOrigin
      : this.audioElement
        ? this.audioElement.currentTime - this.beatOrigin
        : this.elapsed;
    if (this.demo && this.state === "strum")
      this.host.dataset.beatPhase = (
        ((((beatTime * this.bpm) / 60) % 1) + 1) %
        1
      ).toFixed(4);
    const phase = ((((beatTime * this.bpm) / 60) % 1) + 1) % 1;
    const stroke = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const neck = loaded.skeleton.find((b) => norm(b.name) === "neck");
    if (head && loaded.root.userData.headRestY === undefined)
      loaded.root.userData.headRestY = head.position.y;
    if (this.decal)
      this.decal.mix.value =
        this.state === "hop"
          ? 1 -
            THREE.MathUtils.smoothstep(
              this.hopSitTime,
              SPRITE_DECAL.fade[0],
              SPRITE_DECAL.fade[1],
            )
          : 0;
    if (this.state === "hop") this.tickHopSit(loaded, delta);
    else if (this.exiting) this.tickExit(loaded, delta);
    else {
      if (head && !loaded.authoredStrum)
        head.position.y = loaded.root.userData.headRestY;
      if (neck && !loaded.authoredStrum) neck.rotation.x = 0;

      loaded.root.position.set(0, 0, ROOT_Z);
      loaded.root.rotation.set(0, loaded.facing + this.strumYaw, 0);
      this.plantStance(loaded);
      loaded.root.updateWorldMatrix(true, true);
      const toeY = Math.min(
        loaded.toes[0].getWorldPosition(tmpA).y,
        loaded.toes[1].getWorldPosition(tmpB).y,
      );
      loaded.root.position.y =
        this.floorWorldY() +
        loaded.toeRest -
        toeY +
        (this.reduced || loaded.authoredStrum ? 0 : stroke * 0.013);
      if (loaded.prop) {
        const guitarEnd = loaded.authoredStrum
          ? GUITAR_PULL.end
          : GUITAR_DURATION;
        this.guitarTime =
          loaded.authoredStrum && this.reduced
            ? guitarEnd
            : Math.min(
                guitarEnd,
                this.guitarTime + delta * (this.pulling ? GUITAR_PULL.rate : 1),
              );
        if (loaded.authoredStrum) {
          this.placeGuitar(loaded.prop);
          if (this.pulling && this.guitarTime >= GUITAR_PULL.settle[1]) {
            this.pulling = false;
            this.syncStrumPlayback();
          }
          if (this.pulling) this.pullGuitar(loaded);
          if (this.musicPending && this.guitarTime >= GUITAR_PULL.end) {
            this.musicPending = false;
            this.startMusic();
          }
        } else {
          const arrival = THREE.MathUtils.smoothstep(
            this.guitarTime / GUITAR_DURATION,
            0,
            0.85,
          );
          loaded.prop.scale.setScalar(
            this.guitarScale * (1 + 0.08 * Math.sin(arrival * Math.PI)),
          );
          const spin = -12 * (1 - arrival) + 6 * Math.sin(arrival * Math.PI);
          loaded.prop.rotation.z =
            loaded.metadata.guitar.rotation[2] + THREE.MathUtils.degToRad(spin);
          loaded.prop.position
            .copy(this.guitarOrigin)
            .add(
              tmpA
                .copy(this.guitarCentre)
                .multiplyScalar(this.guitarScale)
                .applyQuaternion(this.guitarBaseRotation),
            )
            .sub(
              tmpB
                .copy(this.guitarCentre)
                .multiplyScalar(loaded.prop.scale.x)
                .applyQuaternion(loaded.prop.quaternion),
            );
        }
      }
      if (head && !this.reduced && !loaded.authoredStrum)
        head.rotation.x = stroke * 0.07;
      if (loaded.authoredStrum && this.state === "strum" && !this.reduced)
        this.strumPulse(
          loaded,
          1 - THREE.MathUtils.smoothstep(this.pauseIdleBlend, 0, 1),
        );
      this.pauseIdle(loaded, delta);
      this.trackChangeGesture(loaded, delta);
      if (
        !loaded.authoredStrum &&
        loaded.targets &&
        loaded.arms &&
        loaded.prop
      ) {
        const strumGrip = loaded.targets[1];
        strumGrip.position.copy(this.strumGripOffset);
        if (!this.reduced && this.guitarTime >= GUITAR_DURATION)
          strumGrip.position.y += 0.01 / this.guitarScale;
        loaded.root.updateWorldMatrix(true, true);
        loaded.prop.updateWorldMatrix(true, true);
        const fingerWeight = THREE.MathUtils.lerp(
          0.8,
          1,
          THREE.MathUtils.smoothstep(
            this.guitarTime / GUITAR_DURATION,
            0,
            0.35,
          ),
        );
        const left = loaded.arms[0],
          right = loaded.arms[1];
        const weight = THREE.MathUtils.lerp(
          this.armArrival,
          1,
          THREE.MathUtils.smoothstep(this.guitarTime / GUITAR_DURATION, 0, 0.5),
        );
        left[2].position.copy(loaded.wristRest![0]);
        right[2].position.copy(loaded.wristRest![1]);
        if (loaded.wristRotation) {
          left[2].quaternion.copy(loaded.wristRotation[0]);
          right[2].quaternion.copy(loaded.wristRotation[1]);
        }
        loaded.targets[0].getWorldPosition(neckOrigin);
        neckAlong
          .subVectors(
            loaded.targets[0].getWorldPosition(tmpA),
            strumGrip.getWorldPosition(tmpB),
          )
          .normalize();
        loaded.prop.getWorldQuaternion(fingerWorldQuat);
        neckUp.set(0, 1, 0).applyQuaternion(fingerWorldQuat);
        neckAlong.addScaledVector(neckUp, -neckAlong.dot(neckUp)).normalize();
        neckSide.crossVectors(neckAlong, neckUp).normalize();
        wristGoal.position
          .copy(neckOrigin)
          .addScaledVector(neckAlong, -0.012)
          .addScaledVector(neckUp, -0.008);
        pickWristGoal.position
          .copy(strumGrip.getWorldPosition(pickTipWorld))
          .addScaledVector(neckUp, 0.055 - stroke * 0.012)
          .addScaledVector(neckAlong, 0.01)
          .addScaledVector(bodyUp, 0.015);
        if (weight > 0) {
          solveArm(...left, wristGoal, weight);
          solveArm(...right, pickWristGoal, weight);
          left[0].getWorldPosition(tmpA);
          pole
            .set(0.21, -0.19, 0.12)
            .applyQuaternion(loaded.root.quaternion)
            .add(tmpA);
          steerElbow(left, wristGoal, pole);
          right[0].getWorldPosition(tmpA);
          pole
            .set(-0.22, -0.16, 0.27)
            .applyQuaternion(loaded.root.quaternion)
            .add(tmpA);
          steerElbow(right, pickWristGoal, pole);
          this.distance = [
            finishWrist(left[2], wristGoal),
            finishWrist(right[2], pickWristGoal),
          ];

          left[2].rotation.z = THREE.MathUtils.lerp(
            left[2].rotation.z,
            -0.1,
            weight,
          );
          left[2].rotation.x = THREE.MathUtils.lerp(
            left[2].rotation.x,
            0.12,
            weight,
          );
          left[2].updateWorldMatrix(true, true);
        }
        for (const finger of loaded.fingers) {
          finger.bone.quaternion.copy(finger.rest);
          if (fingerWeight >= 0.6) {
            finger.bone.quaternion.multiply(
              fingerRotation.setFromAxisAngle(
                axis.set(1, 0, 0),
                finger.curl * THREE.MathUtils.smoothstep(fingerWeight, 0.6, 1),
              ),
            );
            if (finger.splay)
              finger.bone.quaternion.multiply(
                fingerSpread.setFromAxisAngle(axis.set(0, 0, 1), finger.splay),
              );
          }
        }
        fitFrets(loaded.fretting, fingerWeight);
        if (fingerWeight === 1 && loaded.fretting.length) {
          const hand = left[2];
          for (let pass = 0; pass < 2; pass++) {
            tmpA.set(0, 0, 0);
            for (const finger of loaded.fretting) {
              finger.joints[2].getWorldPosition(fingerEnd);
              tmpA.add(tmpB.copy(finger.target).sub(fingerEnd));
            }
            tmpA
              .multiplyScalar(1 / loaded.fretting.length)
              .clampLength(0, 0.025);
            hand.parent!.worldToLocal(
              tmpB.copy(hand.getWorldPosition(fingerEnd)).add(tmpA),
            );
            hand.position.copy(tmpB);
            hand.updateWorldMatrix(true, true);
            fitFrets(loaded.fretting, fingerWeight);
          }
        }
        if (loaded.thumb) {
          for (let index = 0; index < 3; index++)
            loaded.thumb[index].quaternion.copy(loaded.thumbRest[index]);
          if (fingerWeight >= 0.6)
            loaded.thumb[0].quaternion.multiply(
              fingerRotation.setFromAxisAngle(
                axis.set(0, 0, 1),
                -0.6 * THREE.MathUtils.smoothstep(fingerWeight, 0.6, 1),
              ),
            );
        }
        const pickIndex = loaded.pickIndex;
        if (pickIndex) {
          right[2].updateWorldMatrix(true, true);
          pickIndex.getWorldPosition(pickTipWorld);
          right[2].getWorldPosition(tmpA);
          handAim.subVectors(pickTipWorld, tmpA).normalize();
          handDesired
            .subVectors(
              strumGrip.getWorldPosition(tmpB),
              pickWristGoal.position,
            )
            .normalize();
          handWorldCorrection.setFromUnitVectors(handAim, handDesired);
          right[2].parent!.getWorldQuaternion(handParentWorld).invert();
          handLocalCorrection
            .copy(handParentWorld)
            .multiply(handWorldCorrection)
            .multiply(handParentWorld.invert());
          right[2].quaternion.premultiply(handLocalCorrection);
          right[2].updateWorldMatrix(true, true);
          pickIndex.getWorldPosition(pickTipWorld);
          pickWristGoal.position.add(
            tmpA
              .copy(strumGrip.getWorldPosition(tmpB))
              .sub(pickTipWorld)
              .clampLength(0, 0.06),
          );
          solveArm(...right, pickWristGoal, 1);
          pickIndex.getWorldPosition(pickTipWorld);
          right[2].parent!.worldToLocal(
            tmpA.copy(strumGrip.getWorldPosition(tmpB)),
          );
          right[2].parent!.worldToLocal(tmpC.copy(pickTipWorld));
          right[2].position.add(
            tmpA
              .sub(tmpC)
              .clampLength(0, 0.035 / right[2].parent!.getWorldScale(axis).x),
          );
          pickWristGoal.position.copy(right[2].getWorldPosition(tmpA));
        }
        right[2].rotation.z +=
          !this.reduced && this.guitarTime >= GUITAR_DURATION
            ? (stroke - 0.5) * THREE.MathUtils.degToRad(8)
            : 0;
        this.host.dataset.leftHandDistance = this.distance[0].toFixed(4);
        this.host.dataset.rightHandDistance = this.distance[1].toFixed(4);
        if (this.demo && weight === 1)
          for (let index = 0; index < loaded.fretting.length; index++) {
            loaded.fretting[index].joints[2].getWorldPosition(fingerEnd);
            this.host.dataset[`fret${index}Distance`] = fingerEnd
              .distanceTo(loaded.fretting[index].target)
              .toFixed(4);
          }
      } else if (
        this.demo &&
        loaded.authoredStrum &&
        loaded.targets &&
        loaded.fretting[0] &&
        loaded.pickIndex
      ) {
        loaded.root.updateWorldMatrix(true, true);
        this.distance = [
          loaded.fretting[0].joints[2]
            .getWorldPosition(tmpA)
            .distanceTo(loaded.targets[0].getWorldPosition(tmpB)),
          loaded.pickIndex
            .getWorldPosition(tmpA)
            .distanceTo(loaded.targets[1].getWorldPosition(tmpB)),
        ];
      }
    }
    if (head) {
      head.updateWorldMatrix(true, false);
      const forward = tmpD.set(0, 0, 1).transformDirection(head.matrixWorld);
      this.host.dataset.headForwardX = forward.x.toFixed(4);
      this.host.dataset.headForwardZ = forward.z.toFixed(4);
    }
    if (this.demo) {
      const chest =
        loaded.skeleton.find((b) => norm(b.name) === "spine2") ?? loaded.hips;
      chest.updateWorldMatrix(true, false);
      const forward = tmpD.set(0, 0, 1).transformDirection(chest.matrixWorld);
      this.host.dataset.chestForwardX = forward.x.toFixed(4);
      this.host.dataset.chestForwardZ = forward.z.toFixed(4);
      this.host.dataset.rootYawDeg = THREE.MathUtils.radToDeg(
        2 * Math.atan2(loaded.root.quaternion.y, loaded.root.quaternion.w),
      ).toFixed(2);
    }
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (width && height) {
      if (this.canvasWidth !== width || this.canvasHeight !== height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.renderer.setSize(width, height, false);
      }
      const verticalHalf = (stageScenePx() * height) / 2;
      const horizontalHalf = (verticalHalf * width) / height;
      const cameraX = 0;
      this.camera.left = -horizontalHalf;
      this.camera.right = horizontalHalf;
      this.camera.top = verticalHalf;
      this.camera.bottom = -verticalHalf;
      this.camera.updateProjectionMatrix();
      const cameraY = 0.35;
      const yaw =
        this.demo && this.state !== "peek"
          ? THREE.MathUtils.degToRad(this.demoCameraDegrees)
          : 0;
      const orbitX = cameraX + Math.sin(yaw) * 5;
      const focusZ = yaw ? 1.05 : 0;
      this.camera.position.set(orbitX, cameraY, focusZ + Math.cos(yaw) * 5);
      this.camera.lookAt(cameraX, cameraY, focusZ);
      if (this.demo && this.state !== "peek") {
        const projection = (bone: THREE.Bone | undefined, key: string) => {
          if (!bone) return;
          bone.getWorldPosition(tmpA).project(this.camera);
          this.host.dataset[key] = (((1 - tmpA.y) * height) / 2).toFixed(2);
        };
        projection(head, "headScreenY");
        if (head && this.state === "hop") {
          head.getWorldPosition(tmpA).project(this.camera);
          this.host.dataset.headScreenX = (((1 + tmpA.x) * width) / 2).toFixed(
            2,
          );
        }
        projection(
          loaded.skeleton.find((bone) => norm(bone.name) === "leftfoot"),
          "leftFootScreenY",
        );
        projection(
          loaded.skeleton.find((bone) => norm(bone.name) === "rightfoot"),
          "rightFootScreenY",
        );
        if (this.state === "strum" && loaded.targets) {
          const point = (node: THREE.Object3D | undefined, key: string) => {
            if (!node) return;
            node.getWorldPosition(tmpA).project(this.camera);
            this.host.dataset[`${key}X`] = (((1 + tmpA.x) * width) / 2).toFixed(
              2,
            );
            this.host.dataset[`${key}Y`] = (
              ((1 - tmpA.y) * height) /
              2
            ).toFixed(2);
          };
          point(loaded.arms?.[1][2], "rightWrist");
          point(
            loaded.skeleton.find(
              (bone) => norm(bone.name) === "righthandindex3",
            ),
            "rightIndex",
          );
          point(
            loaded.skeleton.find(
              (bone) => norm(bone.name) === "righthandmiddle3",
            ),
            "rightMiddle",
          );
          point(
            loaded.skeleton.find(
              (bone) => norm(bone.name) === "lefthandindex3",
            ),
            "leftIndex",
          );
          point(loaded.targets[1], "pickup");
          point(loaded.targets[0], "neckGrip");
          if (loaded.metadata.id === "bob") {
            const names = [
              "spine2",
              "leftshoulder",
              "leftarm",
              "leftforearm",
              "lefthand",
              "rightshoulder",
              "rightarm",
              "rightforearm",
              "righthand",
            ];
            this.host.dataset.bonePose = JSON.stringify({
              rootPosition: loaded.root.position.toArray(),
              rootRotation: loaded.root.quaternion.toArray(),
              rootScale: loaded.root.scale.toArray(),
              bones: Object.fromEntries(
                names.map((name) => {
                  const bone = loaded.skeleton.find(
                    (candidate) => norm(candidate.name) === name,
                  );
                  return [
                    name,
                    bone
                      ? {
                          position: bone.position.toArray(),
                          quaternion: bone.quaternion.toArray(),
                          worldPosition: bone.getWorldPosition(tmpA).toArray(),
                          worldQuaternion: bone.getWorldQuaternion(q).toArray(),
                        }
                      : null,
                  ];
                }),
              ),
            });
          }
        }
      }
    }
    if (
      this.elapsed - this.lastReport > 0.3 ||
      this.lastReport > this.elapsed
    ) {
      this.lastReport = this.elapsed;
      this.reportNow(delta * 1000);
    }
  }

  private floorWorldY() {
    return 0.35 - (this.host.clientHeight / 2 - FLOOR_PX) * stageScenePx();
  }
  private hopSitRest() {
    this.hopSitRestPose ??= fetch(
      `/avatars/clips/rest-${HOP_SIT_SOURCE}.json`,
    ).then((response) => {
      if (!response.ok)
        throw new Error(`HopSit rest pose: HTTP ${response.status}`);

      return response.json() as Promise<RestPose>;
    });
    return this.hopSitRestPose;
  }

  private hipsAboveRoot(loaded: Loaded) {
    loaded.root.scale.copy(loaded.baseScale);
    loaded.root.rotation.set(0, loaded.facing, 0);
    loaded.root.position.set(0, 0, ROOT_Z);
    loaded.root.updateWorldMatrix(true, true);
    return loaded.hips.getWorldPosition(tmpA).y;
  }

  private poseHop(loaded: Loaded, time: number) {
    loaded.hopSit.time = time;
    loaded.mixer.update(0);

    restorePositions(loaded);
    for (const { bone, property, interpolant } of loaded.hopSitTracks) {
      const value = interpolant.evaluate(time);
      if (property === "quaternion") bone.quaternion.fromArray(value);
      else bone.position.fromArray(value);
    }
  }

  private async loadPeekPose(
    id: string,
    skeleton: THREE.Bone[],
  ): Promise<PeekPose> {
    const response = await fetch(`/avatars/${id}/peek.json`);
    if (!response.ok)
      throw new Error(`Avatar ${id} peek pose: HTTP ${response.status}`);

    const peek = (await response.json()) as PeekJson;

    const bones = skeleton.flatMap((bone): PeekBone[] => {
      const name = norm(bone.name);
      if (LEG_CHAIN.test(name)) return [];
      const entry = Object.entries(peek.bones).find(
        ([key]) => norm(key) === name,
      )?.[1];
      return entry
        ? [
            {
              bone,
              position: new THREE.Vector3().fromArray(entry.position),
              quaternion: new THREE.Quaternion().fromArray(entry.quaternion),
              scale: new THREE.Vector3(1, 1, 1).fromArray(
                entry.scale ?? [1, 1, 1],
              ),
              role: HAND_CHAIN.test(name)
                ? "hand"
                : ARM_CHAIN.test(name)
                  ? "arm"
                  : "body",
            },
          ]
        : [];
    });
    return {
      position: new THREE.Vector3().fromArray(peek.root.position),
      quaternion: new THREE.Quaternion().fromArray(peek.root.quaternion),
      scale: new THREE.Vector3().fromArray(peek.root.scale),
      bones,
      left: peek.camera.left,
      top: peek.camera.top,
      pixelsPerUnit: peek.pixelsPerUnit,
    };
  }

  private pageToWorld(x: number, y: number, out: THREE.Vector3) {
    const scenePx = stageScenePx();
    return out.set(
      (x - (window.innerWidth - this.host.clientWidth / 2)) * scenePx,
      0.35 + (window.innerHeight - this.host.clientHeight / 2 - y) * scenePx,
      ROOT_Z,
    );
  }
  private worldToPageY(y: number) {
    return (
      window.innerHeight -
      this.host.clientHeight / 2 -
      (y - 0.35) / stageScenePx()
    );
  }
  private worldToPageX(x: number) {
    return window.innerWidth - this.host.clientWidth / 2 + x / stageScenePx();
  }

  private projectDecal() {
    const decal = this.decal;
    if (!decal) return;

    const spritePx =
      (decal.map.image as HTMLImageElement).width / PEEK_BOX.width;
    const left = window.innerWidth - PEEK_BOX.width - PEEK_OUT,
      top = window.innerHeight - peekBottomPx() - PEEK_BOX.height;

    this.loaded?.root.updateMatrixWorld(true);
    for (const { mesh, uv } of decal.meshes) {
      for (let index = 0; index < uv.count; index++) {
        mesh.getVertexPosition(index, tmpA).applyMatrix4(mesh.matrixWorld);
        uv.setXY(
          index,
          (this.worldToPageX(tmpA.x) - left) * spritePx,
          (this.worldToPageY(tmpA.y) - top) * spritePx,
        );
      }
      uv.needsUpdate = true;
    }
  }

  private yawQuaternion(loaded: Loaded, offset: number, out: THREE.Quaternion) {
    return out.setFromAxisAngle(axis.set(0, 1, 0), loaded.facing + offset);
  }

  private toePoints(
    loaded: Loaded,
    position: THREE.Vector3,
    offset: number,
    out: readonly [THREE.Vector3, THREE.Vector3],
  ) {
    loaded.root.scale.copy(loaded.baseScale);
    loaded.root.position.copy(position);
    this.yawQuaternion(loaded, offset, loaded.root.quaternion);
    loaded.root.updateWorldMatrix(true, true);
    loaded.toes[0].getWorldPosition(out[0]);
    loaded.toes[1].getWorldPosition(out[1]);
    return out;
  }

  private calibrateHopSit(loaded: Loaded) {
    const phases = loaded.hopSitPhases;
    const pose = (time: number) => {
      this.poseHop(loaded, time);
      return this.hipsAboveRoot(loaded);
    };
    this.hopSitContactHipHeight = pose(phases.contact);

    const toeY = Math.min(
      loaded.toes[0].getWorldPosition(tmpA).y,
      loaded.toes[1].getWorldPosition(tmpB).y,
    );
    this.hopSitLandedY = this.floorWorldY() + loaded.toeRest - toeY;

    pose(phases.settled);
    this.toePoints(
      loaded,
      tmpD.set(0, this.hopSitLandedY, ROOT_Z),
      this.strumYaw,
      this.standToes,
    );

    pose(0);
    const peek = loaded.peekPose;
    const spritePx = peek.pixelsPerUnit / 2;
    this.pageToWorld(
      window.innerWidth -
        PEEK_BOX.width -
        PEEK_OUT +
        (peek.position.x - peek.left) * spritePx,
      window.innerHeight -
        peekBottomPx() -
        PEEK_BOX.height +
        (peek.top - peek.position.y) * spritePx,
      this.peekRootPosition,
    );
    this.peekRootScale
      .copy(peek.scale)
      .multiplyScalar(spritePx * stageScenePx());
    for (const { bone, position, quaternion, scale } of peek.bones) {
      bone.position.copy(position);
      bone.quaternion.copy(quaternion);
      bone.scale.copy(scale);
    }
    loaded.root.position.copy(this.peekRootPosition);
    loaded.root.quaternion.copy(peek.quaternion);
    loaded.root.scale.copy(this.peekRootScale);
    loaded.root.updateWorldMatrix(true, true);
    loaded.hips.getWorldPosition(this.peekHips);
    this.projectDecal();
    if (loaded.arms)
      for (let side = 0; side < 2; side++) {
        const [shoulder, elbow, hand] = loaded.arms[side];
        this.peekArms[side][0].copy(shoulder.quaternion);
        this.peekArms[side][1].copy(elbow.quaternion);
        this.peekArms[side][2].copy(hand.quaternion);
      }

    pose(phases.contact);
    this.toePoints(
      loaded,
      tmpD.set(0, this.hopSitLandedY, ROOT_Z),
      this.profileYaw,
      this.contactToes,
    );
    const contactHipsX = loaded.hips.getWorldPosition(tmpA).x;
    this.hopSitContactRoot.set(
      this.peekHips.x -
        ((DROP_DRIFT_PX * window.innerHeight) / 900) * stageScenePx() -
        contactHipsX,
      this.hopSitLandedY,
      ROOT_Z +
        (this.standToes[0].z +
          this.standToes[1].z -
          this.contactToes[0].z -
          this.contactToes[1].z) /
          2,
    );
    this.toePoints(
      loaded,
      this.hopSitContactRoot,
      this.profileYaw,
      this.contactToes,
    );

    const pushTime = phases.takeoff - phases.pushStart;

    const launch = (2 * PUSH_LOWER) / pushTime;
    const drop =
      this.peekHips.y -
      PUSH_LOWER -
      this.hopSitLandedY -
      this.hopSitContactHipHeight;
    const ballistic =
      (Math.sqrt(launch * launch + 2 * FALL_GRAVITY * Math.max(0, drop)) -
        launch) /
      FALL_GRAVITY;
    const fall = (this.hopSitFall = Math.max(
      ballistic,
      phases.fallHoldStart -
        phases.takeoff +
        phases.contact -
        phases.fallHoldEnd +
        0.05,
    ));
    pose(phases.takeoff);
    this.yawQuaternion(loaded, this.profileYaw, loaded.root.quaternion);
    this.placeHips(loaded, this.peekHips);

    const deep = (this.hopSitDeepHipX =
      this.peekHips.x +
      ((WINDUP_PX * window.innerHeight) / 900) * stageScenePx());
    const hipsOverRoot = this.peekHips.x - loaded.root.position.x;
    const lead = ((2 - FALL_DRIFT_END) * pushTime) / fall;
    const takeoffX =
      (lead * (this.hopSitContactRoot.x + hipsOverRoot) + PUSH_BURST * deep) /
      (lead + PUSH_BURST);
    this.hopSitPushTravel = takeoffX - deep;
    this.pushOffset
      .subVectors(this.hopSitContactRoot, loaded.root.position)
      .multiplyScalar(pushTime / (2 * fall + pushTime));
    this.pushOffset.x = takeoffX - this.peekHips.x;
    this.pushOffset.y = -PUSH_LOWER;
    this.placeHips(loaded, tmpD.copy(this.peekHips).add(this.pushOffset));
    this.hopSitTakeoffRoot.copy(loaded.root.position);
    this.hopSitHipTakeoffY = tmpD.y;
    pose(0);
    this.placeHang(loaded, 0);
  }

  private placeHips(loaded: Loaded, target: THREE.Vector3) {
    loaded.root.position.set(0, 0, 0);
    loaded.root.updateWorldMatrix(true, true);
    loaded.root.position.subVectors(target, loaded.hips.getWorldPosition(tmpA));
    loaded.root.updateWorldMatrix(true, true);
  }

  private placeHang(loaded: Loaded, elapsed: number) {
    const phases = loaded.hopSitPhases;
    const peek = loaded.peekPose;

    const turn = THREE.MathUtils.smoothstep(
      elapsed,
      HUP.delay,
      HUP.delay + phases.pullOut,
    );
    const release = THREE.MathUtils.smoothstep(
      elapsed,
      HUP.delay,
      HUP.delay + phases.pullOut * PEEK_RELEASE,
    );
    const handGo = letGo(elapsed, HAND_RELEASE);
    if (release < 1 || handGo < 1)
      for (const { bone, position, quaternion, scale, role } of peek.bones) {
        const wrist =
          bone === loaded.arms?.[0][2]
            ? 0
            : bone === loaded.arms?.[1][2]
              ? 1
              : undefined;
        if (role === "arm") {
          const left =
            bone === loaded.arms?.[0][0] || bone === loaded.arms?.[0][1];
          bone.position.lerpVectors(
            position,
            tmpA.copy(bone.position),
            letGo(elapsed, ARM_RELEASE[left ? 0 : 1]),
          );
          continue;
        }
        const weight = role === "hand" ? handGo : release;
        if (wrist !== undefined)
          bone.position.lerpVectors(
            position,
            tmpA.copy(bone.position),
            letGo(elapsed, WRIST_RELEASE[wrist]),
          );
        if (weight >= 1) continue;
        if (wrist === undefined) {
          bone.quaternion.slerpQuaternions(
            quaternion,
            q.copy(bone.quaternion),
            weight,
          );
          bone.position.lerpVectors(position, tmpA.copy(bone.position), weight);
        }
        if (role === "hand")
          bone.scale.lerpVectors(scale, tmpA.copy(bone.scale), weight);
      }
    loaded.root.quaternion.slerpQuaternions(
      peek.quaternion,
      this.yawQuaternion(loaded, this.profileYaw, q),
      turn,
    );
    loaded.root.scale.lerpVectors(
      this.peekRootScale,
      loaded.baseScale,
      THREE.MathUtils.smoothstep(
        elapsed,
        HUP.delay,
        HUP.delay + PEEK_SCALE_TIME,
      ),
    );
    const push = THREE.MathUtils.clamp(
      (elapsed - phases.pushStart) / (phases.takeoff - phases.pushStart),
      0,
      1,
    );

    const wind =
      elapsed < phases.pushStart
        ? windUp((elapsed - HUP.delay) / phases.pushStart)
        : 1 - THREE.MathUtils.smoothstep(push, 0, 0.65);
    loaded.root.quaternion.premultiply(
      q.setFromAxisAngle(
        tmpC.set(0, 0, 1),
        -THREE.MathUtils.degToRad(WINDUP_LEAN) * wind,
      ),
    );
    tmpD.copy(this.peekHips).addScaledVector(this.pushOffset, push * push);

    tmpD.x =
      elapsed < phases.pushStart
        ? this.peekHips.x +
          ((wind * WINDUP_PX * window.innerHeight) / 900) * stageScenePx()
        : this.hopSitDeepHipX +
          this.hopSitPushTravel *
            push *
            push *
            (3 - PUSH_BURST + (PUSH_BURST - 2) * push);
    this.placeHips(loaded, tmpD);
    if (elapsed < HUP.release) this.hup(loaded, elapsed);
    if (handGo < 1) this.releaseArms(loaded, elapsed, handGo);
  }

  private hup(loaded: Loaded, elapsed: number) {
    const px = stageScenePx();
    const tilt = 1 - THREE.MathUtils.smoothstep(elapsed, 0, HUP.release);
    if (this.spriteTilt.angle || this.spriteTilt.rise) {
      this.pageToWorld(
        window.innerWidth - PEEK_OUT,
        window.innerHeight - peekBottomPx() - PEEK_BOX.height * 0.34,
        tmpC,
      );
      q.setFromAxisAngle(
        axis.set(0, 0, 1),
        -THREE.MathUtils.degToRad(this.spriteTilt.angle) * tilt,
      );
      loaded.root.position.sub(tmpC).applyQuaternion(q).add(tmpC);
      loaded.root.quaternion.premultiply(q);
      loaded.root.position.y -= this.spriteTilt.rise * px * tilt;
      loaded.root.updateWorldMatrix(true, true);
    }
    loaded.head.localToWorld(tmpB.copy(loaded.headCentre));
    if (elapsed === 0) {
      this.hupHead.copy(tmpB);
      return;
    }
    const go = THREE.MathUtils.smoothstep(elapsed, 0, HUP.peak),
      hold = 1 - THREE.MathUtils.smoothstep(elapsed, HUP.peak, HUP.release);
    loaded.hips.getWorldPosition(tmpA);

    q.setFromAxisAngle(
      axis.set(0, 0, 1),
      (-(this.hupHead.x - HUP.out * px * go - tmpB.x) * hold) /
        (tmpB.y - tmpA.y),
    );
    loaded.root.position.sub(tmpA).applyQuaternion(q).add(tmpA);
    loaded.root.quaternion.premultiply(q);
    loaded.root.updateWorldMatrix(true, true);
    loaded.head.localToWorld(tmpB.copy(loaded.headCentre));
    loaded.root.position.y +=
      (this.hupHead.y + HUP.up * px * go - tmpB.y) * hold;
    loaded.root.updateWorldMatrix(true, true);
  }

  private releaseArms(loaded: Loaded, elapsed: number, hand: number) {
    if (!loaded.arms) return;
    for (let side = 0; side < 2; side++) {
      const ease = side
        ? (t: number, d: number) => THREE.MathUtils.smootherstep(t, 0, d)
        : letGo;
      const arm = ease(elapsed, ARM_RELEASE[side]),
        elbow = ease(elapsed, ELBOW_RELEASE[side]);
      const [shoulderBone, elbowBone, handBone] = loaded.arms[side];
      const [peekShoulder, peekElbow, peekHand] = this.peekArms[side];
      armClip[0].copy(shoulderBone.quaternion);
      armClip[1].copy(elbowBone.quaternion);
      armClip[2].copy(handBone.quaternion);

      shoulderBone.quaternion.copy(peekShoulder);
      elbowBone.quaternion.copy(peekElbow);
      handBone.quaternion.copy(peekHand);
      shoulderBone.updateWorldMatrix(true, true);
      const shoulderWorld = shoulderBone.getWorldPosition(tmpA);
      handBone.getWorldPosition(armWrist).sub(shoulderWorld).normalize();

      shoulderBone.quaternion.copy(armClip[0]);
      elbowBone.quaternion.copy(armClip[1]);
      handBone.quaternion.copy(armClip[2]);
      shoulderBone.updateWorldMatrix(true, true);
      if (elbow < 1) {
        handBone.getWorldPosition(tmpB).sub(shoulderWorld).normalize();
        shoulderBone.quaternion.slerpQuaternions(peekShoulder, armClip[0], arm);
        elbowBone.quaternion.slerpQuaternions(peekElbow, armClip[1], elbow);
        shoulderBone.updateWorldMatrix(false, true);
        handBone.getWorldPosition(wristGoal.position).sub(shoulderWorld);
        if (RELEASE_ARC[side] > 0 && arm < 1) {
          tmpC.addVectors(armWrist, tmpB).multiplyScalar(0.5);
          tmpC.y -= RELEASE_DROP[side];
          tmpC.z = RELEASE_ARC[side] * (1 - 2 * side);
          tmpC.normalize();
          slerpDirection(armWrist, tmpC, arm, armWrist);
          slerpDirection(tmpC, tmpB, arm, tmpC);
          slerpDirection(armWrist, tmpC, arm, armWrist);
          swingArm(shoulderBone, wristGoal.position.normalize(), armWrist);
        }
      }

      handBone.quaternion.slerpQuaternions(peekHand, armClip[2], hand);
      handBone.updateWorldMatrix(false, true);
    }
  }

  private plantStance(loaded: Loaded) {
    if (this.state !== "strum") return;
    this.saveOffsets();
    for (let side = 0; side < 2; side++)
      this.legs[side]?.forEach((bone, index) =>
        bone.quaternion.copy(this.strumLegs[side][index]),
      );
    loaded.root.updateWorldMatrix(true, true);
    for (let side = 0; side < 2; side++) {
      const leg = this.legs[side];
      if (!leg) continue;
      const goal = loaded.root.worldToLocal(
        loaded.toes[side].getWorldPosition(toeGoals[side]),
      );
      goal.x = this.strumStance[side].x;
      goal.z = this.strumStance[side].z;
      plantFoot(leg, loaded.toes[side], loaded.root.localToWorld(goal));
      rollKnee(
        leg,
        THREE.MathUtils.degToRad(KNEE_FORWARD.roll),
        tmpD.set(0, 0, 1).applyQuaternion(loaded.root.quaternion),
      );
    }
  }

  private saveOffsets() {
    if (this.pulsed) return;
    for (const saved of this.pulseSaved) {
      saved.quaternion.copy(saved.bone.quaternion);
      saved.position.copy(saved.bone.position);
    }
    this.pulsed = true;
  }

  private catchDip() {
    const after = this.guitarTime - GUITAR_CATCH.at;
    if (after <= 0 || this.reduced) return 0;
    return after < GUITAR_CATCH.peak
      ? Math.sin(((Math.PI / 2) * after) / GUITAR_CATCH.peak)
      : 1 -
          THREE.MathUtils.smoothstep(
            after,
            GUITAR_CATCH.peak,
            GUITAR_CATCH.peak + GUITAR_CATCH.recover,
          );
  }

  private strumPulse(loaded: Loaded, activity = 1) {
    const strumFrom =
      this.strumStart > 0
        ? this.strumStart + GUITAR_PULL.ease / GUITAR_PULL.rate / 2
        : 0;
    const weight =
      activity *
      THREE.MathUtils.smoothstep(
        this.elapsed - strumFrom,
        STRUM_PULSE.fadeIn[0],
        STRUM_PULSE.fadeIn[1],
      );
    const caught = this.catchDip();
    if (weight === 0 && caught === 0) return;

    const beat = (loaded.strum.time * loaded.strumBpm) / 60;
    const dip = (lag: number) =>
      weight *
      (0.5 +
        0.5 *
          Math.cos(
            2 * Math.PI * (beat - STRUM_PULSE.pick - (lag * this.bpm) / 60),
          ));
    this.saveOffsets();
    loaded.root.updateWorldMatrix(true, true);
    loaded.head.quaternion.multiply(
      q.setFromAxisAngle(
        axis.set(1, 0, 0),
        THREE.MathUtils.degToRad(STRUM_PULSE.nod) *
          dip(STRUM_PULSE.chestLag + STRUM_PULSE.nodLag),
      ),
    );
    loaded.head.updateWorldMatrix(false, true);

    const chest = this.chestTwist[this.chestTwist.length - 1];
    if (!chest) return;
    let pitch =
      THREE.MathUtils.degToRad(STRUM_PULSE.chest) * dip(STRUM_PULSE.chestLag);
    if (caught > 0 && loaded.targets) {
      tmpD.set(0, 0, 1).applyQuaternion(loaded.root.quaternion);
      const reach = loaded.targets[1]
        .getWorldPosition(tmpA)
        .sub(chest.getWorldPosition(tmpB))
        .dot(tmpD);
      pitch +=
        (GUITAR_CATCH.hands * stageScenePx() * caught) / Math.max(reach, 0.05);
    }
    twistWorld(
      chest,
      pitch,
      tmpC.set(1, 0, 0).applyQuaternion(loaded.root.quaternion),
    );
  }

  private trackChangeGesture(loaded: Loaded, delta: number) {
    const available =
      this.state === "strum" &&
      !this.paused &&
      !this.exiting &&
      !this.pulling &&
      this.guitarTime >=
        (loaded.authoredStrum ? GUITAR_PULL.settle[1] : GUITAR_DURATION);
    if (this.trackChangeActive && !available) {
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.syncStrumPlayback();
    }
    if (this.trackChangeActive && available) {
      this.trackChangeElapsed += delta;
      if (
        !this.trackChangeFrozen &&
        this.trackChangeElapsed >= this.trackChangeFinish
      ) {
        this.trackChangeFrozen = true;
        this.syncStrumPlayback();
      }
    }

    const rising =
      this.trackChangeActive &&
      this.trackChangeFrozen &&
      this.trackChangeElapsed < TRACK_CHANGE.releaseAt;
    const falling =
      !this.trackChangeActive ||
      this.trackChangeElapsed >= TRACK_CHANGE.releaseAt;
    if (rising)
      this.trackChangeBlend = Math.min(
        1,
        this.trackChangeBlend + delta / TRACK_CHANGE.attack,
      );
    else if (falling)
      this.trackChangeBlend = Math.max(
        0,
        this.trackChangeBlend -
          delta / (TRACK_CHANGE.end - TRACK_CHANGE.releaseAt),
      );

    if (
      this.trackChangeActive &&
      this.trackChangeElapsed >= TRACK_CHANGE.end &&
      this.trackChangeBlend === 0
    ) {
      this.trackChangeActive = false;
      this.trackChangeFrozen = false;
      this.trackChangeElapsed = 0;
      this.syncStrumPlayback();
      if (!this.paused && !this.exiting) this.startMusic();
    }
    if (this.trackChangeBlend === 0) {
      if (this.demo) this.host.dataset.trackChangeWeight = "0.0000";
      return;
    }

    const weight =
      THREE.MathUtils.smoothstep(this.trackChangeBlend, 0, 1) *
      (1 - THREE.MathUtils.smoothstep(this.pauseIdleBlend, 0, 1));
    if (weight === 0) {
      if (this.demo) this.host.dataset.trackChangeWeight = "0.0000";
      return;
    }
    this.saveOffsets();
    loaded.root.updateWorldMatrix(true, true);

    loaded.head.quaternion.multiply(
      q.setFromAxisAngle(
        axis.set(1, 0, 0),
        THREE.MathUtils.degToRad(TRACK_CHANGE.headPitch) * weight,
      ),
    );
    loaded.head.updateWorldMatrix(false, true);

    if (!loaded.arms || !loaded.prop) return;
    const right = loaded.arms[1];

    right[2].getWorldPosition(trackWristGoal.position);
    loaded.prop.getWorldQuaternion(q);
    pauseNormal.set(0, 0, 1).applyQuaternion(q).normalize();
    trackWristGoal.position.addScaledVector(pauseNormal, TRACK_CHANGE.handOut);
    trackWristGoal.position.y += TRACK_CHANGE.handUp;
    trackWristGoal.position.x += TRACK_CHANGE.handSide;
    armClip[0].copy(right[0].quaternion);
    armClip[1].copy(right[1].quaternion);
    armClip[2].copy(right[2].quaternion);
    right[0].getWorldPosition(tmpA);
    pole
      .set(-0.22, -0.1, 0.25)
      .applyQuaternion(loaded.root.quaternion)
      .add(tmpA);
    reachArm(right, trackWristGoal.position, pole);
    trackArmSolved[0].copy(right[0].quaternion);
    trackArmSolved[1].copy(right[1].quaternion);
    trackArmSolved[2].copy(right[2].quaternion);
    right[0].quaternion.slerpQuaternions(armClip[0], trackArmSolved[0], weight);
    right[1].quaternion.slerpQuaternions(armClip[1], trackArmSolved[1], weight);
    right[2].quaternion.slerpQuaternions(armClip[2], trackArmSolved[2], weight);
    right[0].updateWorldMatrix(false, true);
    for (const finger of loaded.fingers) {
      if (finger.left) continue;
      fingerRotation
        .copy(finger.rest)
        .multiply(
          fingerSpread.setFromAxisAngle(axis.set(1, 0, 0), finger.curl * 0.3),
        );
      finger.bone.quaternion.slerp(fingerRotation, weight * 0.6);
    }
    if (this.demo) {
      this.host.dataset.trackChangeWeight = weight.toFixed(4);
      this.host.dataset.trackChangeTime = this.trackChangeElapsed.toFixed(4);
      this.host.dataset.trackWristX = this.worldToPageX(
        right[2].getWorldPosition(tmpA).x,
      ).toFixed(2);
      this.host.dataset.trackWristY = this.worldToPageY(
        right[2].getWorldPosition(tmpA).y,
      ).toFixed(2);
    }
  }

  private pauseIdle(loaded: Loaded, delta: number) {
    const settled =
      this.state === "strum" &&
      this.paused &&
      !this.exiting &&
      !this.pulling &&
      this.guitarTime >=
        (loaded.authoredStrum ? GUITAR_PULL.settle[1] : GUITAR_DURATION);
    const direction = settled ? 1 : -1;
    this.pauseIdleBlend = THREE.MathUtils.clamp(
      this.pauseIdleBlend + (direction * delta) / PAUSE_IDLE.ease,
      0,
      1,
    );
    if (this.pauseIdleBlend === 0) {
      this.pauseIdleTime = 0;
      return;
    }
    this.pauseIdleTime += delta;
    const weight = THREE.MathUtils.smoothstep(this.pauseIdleBlend, 0, 1);
    this.saveOffsets();

    if (loaded.targets && loaded.arms && loaded.prop) {
      const [, strumGrip] = loaded.targets;
      strumGrip.getWorldPosition(pauseWristGoal.position);
      loaded.prop.getWorldQuaternion(q);
      pauseNormal.set(0, 0, 1).applyQuaternion(q);

      pauseWristGoal.position.y += 0.045;
      pauseWristGoal.position.addScaledVector(pauseNormal, 0.014);
      if (this.demo) {
        this.host.dataset.pauseIdleWeight = weight.toFixed(4);
        this.host.dataset.pauseWristX = pauseWristGoal.position.x.toFixed(4);
        this.host.dataset.pauseWristY = pauseWristGoal.position.y.toFixed(4);
        this.host.dataset.pauseWristZ = pauseWristGoal.position.z.toFixed(4);
      }
      loaded.root.updateWorldMatrix(true, true);
      const right = loaded.arms[1];
      armClip[0].copy(right[0].quaternion);
      armClip[1].copy(right[1].quaternion);
      armClip[2].copy(right[2].quaternion);
      right[0].getWorldPosition(tmpA);
      pole
        .set(-0.18, -0.12, 0.22)
        .applyQuaternion(loaded.root.quaternion)
        .add(tmpA);
      reachArm(right, pauseWristGoal.position, pole);
      right[0].quaternion.slerpQuaternions(
        armClip[0],
        right[0].quaternion,
        weight,
      );
      right[1].quaternion.slerpQuaternions(
        armClip[1],
        right[1].quaternion,
        weight,
      );
      right[2].quaternion.slerpQuaternions(
        armClip[2],
        right[2].quaternion,
        weight,
      );
      right[0].updateWorldMatrix(false, true);

      for (const finger of loaded.fingers) {
        fingerRotation
          .copy(finger.rest)
          .multiply(
            fingerSpread.setFromAxisAngle(
              axis.set(1, 0, 0),
              finger.curl * 0.28,
            ),
          );
        finger.bone.quaternion.slerp(fingerRotation, weight * 0.72);
      }
    }

    const phase = (this.pauseIdleTime * 2 * Math.PI) / PAUSE_IDLE.scan;
    const yaw =
      THREE.MathUtils.degToRad(PAUSE_IDLE.yaw) *
      (0.72 * Math.sin(phase) + 0.28 * Math.sin(phase * 0.47 + 0.8));
    const pitch =
      THREE.MathUtils.degToRad(PAUSE_IDLE.pitch) *
      Math.sin(phase * 0.61 - 0.35);
    loaded.head.quaternion.multiply(
      q.setFromAxisAngle(axis.set(0, 1, 0), yaw * weight),
    );
    loaded.head.quaternion.multiply(
      q.setFromAxisAngle(axis.set(1, 0, 0), pitch * weight),
    );
    loaded.head.updateWorldMatrix(false, true);
  }

  private placeGuitar(prop: THREE.Object3D) {
    if (!this.exiting) {
      prop.position.copy(this.guitarOrigin);
      prop.quaternion.copy(this.guitarBaseRotation);
      prop.scale.setScalar(this.guitarScale);
      return;
    }
    prop.parent!.getWorldQuaternion(guitarParent).invert();
    const scale =
      1 -
      THREE.MathUtils.smoothstep(
        this.exitTime,
        EXIT.guitarShrink[0],
        EXIT.guitarShrink[1],
      );
    const spin =
      EXIT.guitarSpin *
      THREE.MathUtils.smoothstep(this.exitTime, EXIT.guitar[0], EXIT.guitar[1]);
    prop.visible = scale > 0;
    guitarPivot
      .copy(this.guitarCentre)
      .multiplyScalar(this.guitarScale)
      .applyQuaternion(this.exitGuitarRotation)
      .add(this.exitGuitarPosition);
    guitarSpin.setFromAxisAngle(
      guitarAxis.set(0, 0, 1).applyQuaternion(guitarParent),
      THREE.MathUtils.degToRad(spin),
    );
    prop.position
      .copy(this.exitGuitarPosition)
      .sub(guitarPivot)
      .multiplyScalar(scale)
      .applyQuaternion(guitarSpin)
      .add(guitarPivot);
    prop.quaternion.copy(guitarSpin).multiply(this.exitGuitarRotation);
    prop.scale.setScalar(this.guitarScale * Math.max(scale, 1e-3));
  }

  private pullGuitar(loaded: Loaded) {
    const prop = loaded.prop!,
      [leftArm, right] = loaded.arms!,
      { carry, elbow, left } = GUITAR_PULL,
      t = this.guitarTime,
      rad = THREE.MathUtils.degToRad;
    this.saveOffsets();
    for (let side = 0; side < 2; side++)
      this.pullBones[side].forEach((bone, index) =>
        this.pullClip[side][index].copy(bone.quaternion),
      );
    loaded.root.updateWorldMatrix(true, true);
    loaded.arms!.forEach(([, fore, hand], side) => {
      hand.getWorldPosition(pullClipWrist[side]);
      hand.getWorldQuaternion(pullClipHand[side]);
      fore.getWorldPosition(pullClipElbow[side]);
    });

    const settle = THREE.MathUtils.smoothstep(
      t,
      GUITAR_PULL.settle[0],
      GUITAR_PULL.settle[1],
    );
    for (let side = 0; side < 2; side++) {
      const shoulder = this.pullShoulders[side];
      if (shoulder)
        shoulder.quaternion.slerpQuaternions(
          this.pullShoulderHang[side],
          pullPosed.copy(shoulder.quaternion),
          settle,
        );
      for (let index = 0; index < 3; index++)
        this.pullBones[side][index].quaternion.slerpQuaternions(
          this.pullHang[side][index],
          this.pullClip[side][index],
          settle,
        );
    }
    loaded.root.updateWorldMatrix(true, true);

    const k = Math.max(t, carry.t[0]);
    loaded.root.getWorldQuaternion(pullRoot);
    pullTurn.setFromEuler(
      pullEuler.set(
        rad(pchip(carry.t, carry.pitch, k)),
        rad(pchip(carry.t, carry.yaw, k)),
        rad(pchip(carry.t, carry.roll, k)),
        "YXZ",
      ),
    );
    pullTurn
      .premultiply(pullRoot)
      .multiply(pullRootInverse.copy(pullRoot).invert());
    loaded.targets![1].getWorldPosition(pullPivot);
    pullOffset
      .set(
        pchip(carry.t, carry.x, k),
        pchip(carry.t, carry.y, k),
        pchip(carry.t, carry.z, k),
      )
      .applyQuaternion(pullRoot)
      .add(pullPivot);
    pullGuitarWorld
      .makeTranslation(-pullPivot.x, -pullPivot.y, -pullPivot.z)
      .premultiply(pullStep.makeRotationFromQuaternion(pullTurn))
      .premultiply(
        pullStep.makeTranslation(pullOffset.x, pullOffset.y, pullOffset.z),
      )
      .multiply(prop.matrixWorld);

    pullRootInverse.copy(pullRoot).invert();
    pullGoal
      .multiplyMatrices(pullGuitarWorld, this.handOnGuitar)
      .decompose(pullGoalPosition, pullGoalRotation, pullScale);
    right[0].getWorldPosition(tmpA);
    const span =
      tmpA.distanceTo(right[1].getWorldPosition(tmpC)) +
      tmpC.distanceTo(right[2].getWorldPosition(tmpD));
    const [floor, low, high, cap] = GUITAR_PULL.soft.map(
      (fraction) => fraction * span,
    );
    const soft = (distance: number) =>
      distance > high
        ? high + (cap - high) * Math.tanh((distance - high) / (cap - high))
        : distance < low
          ? low - (low - floor) * Math.tanh((low - distance) / (low - floor))
          : distance;
    tmpB.subVectors(pullGoalPosition, tmpA).applyQuaternion(pullRootInverse);
    const reached = THREE.MathUtils.smoothstep(
      t,
      GUITAR_PULL.reach[0],
      GUITAR_PULL.reach[1],
    );
    if (reached < 1) {
      const from = this.pullHangWrist[1],
        via = GUITAR_PULL.via,
        at = GUITAR_PULL.viaAt,
        length = THREE.MathUtils.lerp(
          from.length(),
          soft(tmpB.length()),
          reached,
        );
      tmpB
        .set(
          through(from.x, via[0], tmpB.x, reached, at),
          through(from.y, via[1], tmpB.y, reached, at),
          through(from.z, via[2], tmpB.z, reached, at),
        )
        .setLength(length);
      pullGoalRotation.copy(
        pullPosed
          .copy(pullRoot)
          .multiply(this.pullHangHand[1])
          .slerp(pullGoalRotation, reached),
      );
    } else tmpB.setLength(soft(tmpB.length()));
    pullGoalPosition.copy(tmpB).applyQuaternion(pullRoot).add(tmpA);
    pullHint
      .set(
        pchip(carry.t, elbow.x, k),
        pchip(carry.t, elbow.y, k),
        pchip(carry.t, elbow.z, k),
      )
      .normalize();
    pullHint
      .lerpVectors(
        tmpC.copy(this.pullHangElbow[1]).normalize(),
        pullHint,
        reached,
      )
      .applyQuaternion(pullRoot)
      .add(tmpA)
      .lerp(pullClipElbow[1], settle);
    reachArm(right, pullGoalPosition.lerp(pullClipWrist[1], settle), pullHint);
    right[2].quaternion.copy(
      right[1]
        .getWorldQuaternion(pullPosed)
        .invert()
        .multiply(pullGoalRotation.slerp(pullClipHand[1], settle)),
    );
    const grabbed = THREE.MathUtils.smoothstep(
      t,
      GUITAR_PULL.grab[0],
      GUITAR_PULL.grab[1],
    );
    for (let index = 3; index < this.pullBones[1].length; index++) {
      this.pullBones[1][index].quaternion
        .slerpQuaternions(
          this.pullHang[1][index],
          this.pullClip[1][index],
          grabbed,
        )
        .slerp(this.pullClip[1][index], settle);
    }
    right[0].updateWorldMatrix(false, true);

    const risen = THREE.MathUtils.smoothstep(t, left.at[0], left.at[1]),
      turned = THREE.MathUtils.smoothstep(t, left.turn[0], left.turn[1]);
    const fingers = THREE.MathUtils.smoothstep(
        t,
        left.fingers[0],
        left.fingers[1],
      ),
      thumb = THREE.MathUtils.smoothstep(t, left.thumb[0], left.thumb[1]);
    leftArm[0].getWorldPosition(tmpA);
    pullGoal
      .multiplyMatrices(prop.matrixWorld, this.leftHandOnGuitar)
      .decompose(pullGoalPosition, pullGoalRotation, pullScale);
    tmpB.subVectors(pullGoalPosition, tmpA).applyQuaternion(pullRootInverse);
    const from = this.pullHangWrist[0],
      via = left.via;
    const a = (1 - risen) * (1 - risen),
      b = 2 * risen * (1 - risen),
      c = risen * risen;
    pullGoalPosition
      .set(
        a * from.x + b * (tmpB.x + via[0]) + c * tmpB.x,
        a * from.y + b * (tmpB.y + via[1]) + c * tmpB.y,
        a * from.z + b * (tmpB.z + via[2]) + c * tmpB.z,
      )
      .setLength(THREE.MathUtils.lerp(from.length(), tmpB.length(), risen))
      .applyQuaternion(pullRoot)
      .add(tmpA);
    pullGoalRotation.copy(
      pullPosed
        .copy(pullRoot)
        .multiply(this.pullHangHand[0])
        .slerp(pullGoalRotation, turned),
    );
    pullHint
      .lerpVectors(
        tmpC.copy(this.pullHangElbow[0]).normalize(),
        tmpD.set(...left.elbow).normalize(),
        risen,
      )
      .applyQuaternion(pullRoot)
      .add(tmpA)
      .lerp(pullClipElbow[0], settle);
    reachArm(
      leftArm,
      pullGoalPosition.lerp(pullClipWrist[0], settle),
      pullHint,
    );
    leftArm[2].quaternion.copy(
      leftArm[1]
        .getWorldQuaternion(pullPosed)
        .invert()
        .multiply(pullGoalRotation.slerp(pullClipHand[0], settle)),
    );
    for (let index = 3; index < this.pullBones[0].length; index++) {
      const bone = this.pullBones[0][index];
      bone.quaternion
        .slerpQuaternions(
          this.pullHang[0][index],
          this.pullClip[0][index],
          this.pullThumb.has(bone) ? thumb : fingers,
        )
        .slerp(this.pullClip[0][index], settle);
    }
    leftArm[0].updateWorldMatrix(false, true);

    if (t >= GUITAR_CATCH.at) return;
    if (t >= GUITAR_PULL.reach[1]) {
      const { at, offset } = GUITAR_PULL.clear;
      const nudge =
        THREE.MathUtils.smoothstep(t, at[0], at[1]) *
        (1 - THREE.MathUtils.smoothstep(t, at[2], at[3]));
      tmpC
        .set(offset[0], offset[1], offset[2])
        .multiplyScalar(nudge)
        .applyQuaternion(pullRoot);
      pullGuitarWorld
        .multiplyMatrices(right[2].matrixWorld, this.guitarOnHand)
        .premultiply(pullStep.makeTranslation(tmpC.x, tmpC.y, tmpC.z));
    }
    pullGuitarWorld
      .premultiply(pullStep.copy(prop.parent!.matrixWorld).invert())
      .decompose(prop.position, prop.quaternion, pullScale);
    prop.scale.setScalar(this.guitarScale);
    prop.updateWorldMatrix(false, true);
  }

  private tickExit(loaded: Loaded, delta: number) {
    this.exitTime += delta * EXIT.rate;
    const t = this.exitTime,
      { skeleton, root } = loaded,
      rad = THREE.MathUtils.degToRad;
    if (loaded.prop) this.placeGuitar(loaded.prop);
    const pose = THREE.MathUtils.smoothstep(t, EXIT.pose[0], EXIT.pose[1]);
    for (let index = 0; index < skeleton.length; index++)
      skeleton[index].quaternion.slerpQuaternions(
        this.exitFrom[index],
        this.exitTo[index],
        pose,
      );
    const turned =
      (THREE.MathUtils.smoothstep(t, EXIT.turn[0], EXIT.turn[1]) * Math.PI) / 2;
    root.rotation.set(0, loaded.facing + this.strumYaw + turned, 0);
    root.position.set(this.exitX, 0, ROOT_Z);
    root.updateWorldMatrix(true, true);
    walkForward.set(Math.sin(turned), 0, Math.cos(turned));
    walkSide.set(0, -1, 0).cross(walkForward);
    const weight = THREE.MathUtils.smoothstep(t, EXIT.walk[0], EXIT.walk[1]);
    const phase = WALK.start + Math.max(0, t - EXIT.walk[0]) / WALK.stride;

    const goal = (angle: number, lateral: number) => {
      const k = Math.sqrt(1 - lateral * lateral);
      return walkGoal
        .copy(walkForward)
        .multiplyScalar(Math.sin(angle) * k)
        .addScaledVector(worldUp, -Math.cos(angle) * k)
        .addScaledVector(walkSide, lateral);
    };
    const lateralOf = (bone: THREE.Object3D, child: THREE.Object3D) =>
      THREE.MathUtils.clamp(
        child
          .getWorldPosition(tmpA)
          .sub(bone.getWorldPosition(tmpB))
          .normalize()
          .dot(walkSide),
        -0.45,
        0.45,
      );

    const hips = loaded.hips;
    aimBone(
      hips,
      this.headTwist[0] ?? loaded.head,
      goal(Math.PI - rad(WALK.lean), 0),
      weight,
    );
    const swing = Math.cos(2 * Math.PI * phase);
    const pelvis = rad(WALK.pelvis) * swing * weight;
    twistWorld(hips, pelvis);
    const chest = this.chestTwist[this.chestTwist.length - 1];
    if (chest) twistWorld(chest, -pelvis - rad(WALK.chest) * swing * weight);
    if (loaded.arms) {
      const armJoin = 0.373,
        armPhase =
          phase +
          ((1 - THREE.MathUtils.smoothstep(t, 0.2, armJoin)) *
            Math.max(0, armJoin - t)) /
            WALK.stride;
      const startup =
        THREE.MathUtils.smoothstep(t, 0.02, 0.14) *
        (1 - THREE.MathUtils.smoothstep(t, 0.28, armJoin));
      const armWeight = Math.max(weight, startup);
      for (let side = 0; side < 2; side++) {
        const [upper, fore, hand] = loaded.arms[side];
        const sign = side === 0 ? 1 : -1;
        const shoulderWave =
          sign * Math.cos(2 * Math.PI * (armPhase - WALK.armPeak));
        const shoulder = rad(WALK.arm[0] + WALK.arm[1] * shoulderWave);
        aimBone(upper, fore, goal(shoulder, lateralOf(upper, fore)), armWeight);

        const elbowWave =
          sign *
          Math.cos(2 * Math.PI * (armPhase - WALK.armPeak - WALK.elbowLag));
        const foreSwing = rad(WALK.arm[0] + WALK.arm[1] * elbowWave),
          forward = Math.max(0, elbowWave);
        aimBone(
          fore,
          hand,
          goal(
            foreSwing + rad(WALK.elbow[0] + WALK.elbow[1] * forward),
            lateralOf(fore, hand),
          ),
          armWeight,
        );
        const wristWave =
          sign *
          Math.sin(2 * Math.PI * (armPhase - WALK.armPeak - WALK.wristLag));
        hand.rotateX(
          rad(WALK.wrist[0] + WALK.wrist[1] * wristWave) * armWeight,
        );
        hand.updateWorldMatrix(false, true);
      }
    }

    const firstTrail = WALK.start % 1 < 0.5 ? 0 : 1,
      firstWeight = Math.max(
        weight,
        THREE.MathUtils.smoothstep(t, WALK.firstStep[0], WALK.firstStep[1]),
      );
    for (let side = 0; side < 2; side++) {
      const leg = this.legs[side];
      if (!leg) continue;
      const [thigh, knee, foot] = leg,
        toe = loaded.toes[side],
        legWeight = side === firstTrail ? firstWeight : weight;
      const legPhase = phase + (side === 0 ? 0.5 : 0);
      const hip = rad(loopCurve(WALK.hip, legPhase)),
        shin = hip - rad(loopCurve(WALK.knee, legPhase));
      aimBone(thigh, knee, goal(hip, lateralOf(thigh, knee)), legWeight);
      aimBone(knee, foot, goal(shin, lateralOf(knee, foot)), legWeight);
      aimBone(
        foot,
        toe,
        goal(
          this.footRest[side] + rad(loopCurve(WALK.foot, legPhase)),
          lateralOf(foot, toe),
        ),
        legWeight,
      );

      const toeEnd = toe.children.find((child) => child instanceof THREE.Bone);
      const cycle = ((legPhase % 1) + 1) % 1,
        [flatIn, flatFull, flatOut, flatEnd] = WALK.toeFlat;
      const flat =
        THREE.MathUtils.smoothstep(cycle, flatIn, flatFull) *
        (1 - THREE.MathUtils.smoothstep(cycle, flatOut, flatEnd));
      if (toeEnd && flat > 0)
        aimBone(
          toe,
          toeEnd,
          goal(Math.PI / 2, lateralOf(toe, toeEnd)),
          legWeight * flat,
        );
    }

    const headBones = this.headTwist.length ? this.headTwist : [loaded.head];
    const face = tmpD.set(0, 0, 1).transformDirection(loaded.head.matrixWorld);
    const yawGoal =
      (THREE.MathUtils.smoothstep(
        t + EXIT.headLead,
        EXIT.turn[0],
        EXIT.turn[1],
      ) *
        Math.PI) /
        2 +
      this.exitHead.yaw * (1 - weight);
    const yawError =
      THREE.MathUtils.euclideanModulo(
        yawGoal - Math.atan2(face.x, face.z) + Math.PI,
        2 * Math.PI,
      ) - Math.PI;
    const pitchError =
      THREE.MathUtils.lerp(this.exitHead.pitch, -rad(WALK.headPitch), weight) -
      Math.asin(THREE.MathUtils.clamp(face.y, -1, 1));
    for (const bone of headBones) twistWorld(bone, yawError / headBones.length);
    tmpC.set(-Math.cos(yawGoal), 0, Math.sin(yawGoal));
    for (const bone of headBones)
      twistWorld(bone, pitchError / headBones.length, tmpC);

    const cycleOf = (side: number) =>
      (((phase + (side === 0 ? 0.5 : 0)) % 1) + 1) % 1;
    const pinned =
        this.exitStance < 0 ? (cycleOf(1) < 0.5 ? 1 : 0) : this.exitStance,
      other = 1 - pinned;
    const otherCycle = cycleOf(other),
      landing = otherCycle < 0.5 || otherCycle > WALK.landing;
    const due =
      landing || (this.exitHold > 0 && otherCycle >= 0.4 && !this.exitFirst);
    let low = Infinity;
    for (let side = 0; side < 2; side++) {
      const heel = loaded.heels[side],
        foot = this.exitFeet[side];
      heel.foot.localToWorld(tmpA.copy(heel.local));
      loaded.toes[side].getWorldPosition(tmpB);
      foot.low = Math.min(tmpA.y, tmpB.y);
      if (side === pinned || due) low = Math.min(low, foot.low);
      foot.shift = THREE.MathUtils.lerp(
        foot.heel - tmpA.x,
        foot.ball - tmpB.x,
        THREE.MathUtils.smoothstep(tmpA.y - tmpB.y, -0.004, 0.004),
      );
      foot.heel = tmpA.x;
      foot.ball = tmpB.x;
    }
    const shift = this.exitStance < 0 ? 0 : this.exitFeet[pinned].shift;
    const next =
      landing &&
      cycleOf(pinned) > 0.3 &&
      (otherCycle < 0.5 ||
        this.exitFeet[other].low <= low + WALK.planted * stageScenePx())
        ? other
        : pinned;
    const struck = next !== this.exitStance;
    if (struck && this.exitStance >= 0) this.exitFirst = false;
    this.exitStance = next;
    for (const foot of this.exitFeet) {
      foot.heel += shift;
      foot.ball += shift;
    }
    this.exitX += shift;
    const floor =
      this.floorWorldY() + loaded.toeRest + this.exitLift * (1 - pose);
    root.position.set(this.exitX, floor - low, ROOT_Z);
    root.updateWorldMatrix(true, true);

    const trail = 1 - next,
      trailCycle = cycleOf(trail);
    if (trailCycle < 0.4) return this.exitEnd(loaded);
    const trailLeg = this.legs[trail],
      trailToe = loaded.toes[trail];
    if (!trailLeg) return this.exitEnd(loaded);
    if (struck) {
      trailToe.getWorldPosition(this.exitTrail).y = floor;
      this.exitHold = 1;
      this.exitHeldFor = 0;
      this.exitBent = 0;
    }
    const lifted =
      trailToe.getWorldPosition(walkGoal).y >
      floor + WALK.lift * stageScenePx();

    const [trailThigh, trailKnee, trailFoot] = trailLeg;
    const holdGoal = (goal: THREE.Vector3) => {
      if (this.exitBent <= rad(WALK.lock + 5)) return goal;
      trailThigh.getWorldPosition(tmpA);
      const upper = tmpA.distanceTo(trailKnee.getWorldPosition(tmpB)),
        lower = tmpB.distanceTo(trailFoot.getWorldPosition(tmpC));
      const reach = Math.sqrt(
        upper * upper +
          lower * lower +
          2 * upper * lower * Math.cos(rad(WALK.lock)),
      );
      const ankle = tmpC
          .add(goal)
          .sub(trailToe.getWorldPosition(pole))
          .sub(tmpA),
        level = reach * reach - ankle.x * ankle.x - ankle.z * ankle.z;
      if (level > 0 && ankle.lengthSq() > reach * reach)
        goal.y -= Math.sqrt(level) + ankle.y;
      return goal;
    };
    if (this.exitHold === 1) {
      bendLeg(trailLeg, trailToe, holdGoal(tmpD.copy(this.exitTrail)));
      bendUpper.subVectors(
        trailKnee.getWorldPosition(tmpB),
        trailThigh.getWorldPosition(tmpA),
      );
      bendLower.subVectors(trailFoot.getWorldPosition(tmpC), tmpB);
      const bend = bendUpper.angleTo(bendLower);
      this.exitBent = Math.max(this.exitBent, bend);
      if (trailCycle >= WALK.toeOff) this.exitHeldFor += delta * EXIT.rate;

      if (
        lifted ||
        (this.exitBent > rad(WALK.lock + 5) && bend <= rad(WALK.lock) + 1e-3) ||
        this.exitHeldFor > WALK.overHold
      )
        this.exitHold = 1 - 1e-6;
    } else if (this.exitHold > 0) {
      for (let bone = 0; bone < 3; bone++)
        legWalk[bone].copy(trailLeg[bone].quaternion);
      this.exitHold = Math.max(
        0,
        this.exitHold - (delta * EXIT.rate) / WALK.release,
      );
      const walked = 1 - THREE.MathUtils.smoothstep(this.exitHold, 0, 1);

      bendLeg(
        trailLeg,
        trailToe,
        holdGoal(
          tmpD
            .copy(this.exitTrail)
            .setY(floor + Math.max(0, walkGoal.y - floor) * Math.sqrt(walked)),
        ),
      );
      for (let bone = 0; bone < 3; bone++)
        trailLeg[bone].quaternion.slerp(legWalk[bone], walked);
      trailLeg[0].updateWorldMatrix(false, true);
    }
    if (this.exitHold < 1 && trailToe.getWorldPosition(walkGoal).y < floor)
      bendLeg(trailLeg, trailToe, walkGoal.setY(floor));
    this.exitEnd(loaded);
  }

  private exitEnd(loaded: Loaded) {
    const edge = window.innerWidth + EXIT.clear;
    if (
      this.exitDone &&
      (this.exitTime >= EXIT.max ||
        loaded.skeleton.every(
          (bone) => this.worldToPageX(bone.getWorldPosition(tmpA).x) > edge,
        ))
    ) {
      const done = this.exitDone;
      this.exitDone = null;
      queueMicrotask(done);
    }
  }

  private tickHopSit(loaded: Loaded, delta: number) {
    const phases = loaded.hopSitPhases;
    const duration = loaded.hopSit.getClip().duration;
    if (performance.now() >= this.scrubHoldUntil) this.hopSitTime += delta;
    const elapsed = this.hopSitTime;
    const fall = this.hopSitFall;
    const contactAt = phases.takeoff + fall;
    const landT = THREE.MathUtils.clamp(
      (elapsed - contactAt) / (phases.settled - phases.contact),
      0,
      1,
    );

    const clipFall = phases.contact - phases.takeoff;
    const u = (elapsed - phases.takeoff) / fall,
      slope = Math.min(1, (2.1 * clipFall) / fall);
    const markerTime =
      elapsed <= phases.takeoff
        ? elapsed
        : elapsed < contactAt
          ? phases.takeoff +
            ((u ** 3 - 2 * u * u + u) * slope * fall +
              (3 * u * u - 2 * u ** 3) * clipFall +
              (u ** 3 - u * u) * slope * fall)
          : phases.contact + elapsed - contactAt;
    this.poseHop(loaded, Math.min(duration - 0.0001, markerTime));

    const hangAt = phases.turnEnd - GUITAR_PULL.hangHold;
    if (
      markerTime > hangAt &&
      loaded.authoredStrum &&
      !this.reduced &&
      loaded.prop &&
      loaded.arms
    ) {
      for (const { bone, property, interpolant } of loaded.hopSitTracks)
        if (property === "quaternion" && this.pullHeld.has(bone))
          bone.quaternion.fromArray(interpolant.evaluate(hangAt));
    }
    const hips = this.hipsAboveRoot(loaded);
    if (elapsed < phases.takeoff) {
      this.placeHang(loaded, elapsed);
    } else if (elapsed < contactAt) {
      const falling = elapsed - phases.takeoff;
      const drop =
        this.hopSitHipTakeoffY -
        this.hopSitLandedY -
        this.hopSitContactHipHeight;
      const launch = (2 * PUSH_LOWER) / (phases.takeoff - phases.pushStart);
      const gravity = (2 * (drop - launch * fall)) / (fall * fall);

      loaded.root.position.lerpVectors(
        this.hopSitTakeoffRoot,
        this.hopSitContactRoot,
        FALL_DRIFT_END * u + (1 - FALL_DRIFT_END) * u * (2 - u),
      );
      loaded.root.position.y =
        this.hopSitHipTakeoffY -
        launch * falling -
        0.5 * gravity * falling * falling -
        hips;
      this.yawQuaternion(loaded, this.profileYaw, loaded.root.quaternion);
    } else {
      const landed = elapsed - contactAt;

      const squash = landSquash(landed);
      loaded.root.scale.set(
        loaded.baseScale.x * (1 + LAND_SQUASH.x * squash),
        loaded.baseScale.y * (1 - LAND_SQUASH.y * squash),
        loaded.baseScale.z * (1 + LAND_SQUASH.x * squash),
      );

      const chest = THREE.MathUtils.smoothstep(
        markerTime,
        phases.turnStart,
        phases.turnEnd,
      );
      const body = THREE.MathUtils.smoothstep(
        markerTime,
        phases.turnStart,
        phases.turnEnd + TURN_LEAD.hips,
      );
      this.yawQuaternion(
        loaded,
        THREE.MathUtils.lerp(this.profileYaw, this.strumYaw, body),
        loaded.root.quaternion,
      );
      loaded.root.position.y = this.hopSitLandedY;

      const right = strike(landed, STEP_WINDOWS[1]),
        left = strike(landed, STEP_WINDOWS[0]);
      toeGoals[1].lerpVectors(this.contactToes[1], this.standToes[1], right);
      tmpA.subVectors(this.contactToes[0], toeGoals[1]);
      tmpB.subVectors(this.standToes[0], toeGoals[1]);
      const from = Math.atan2(tmpA.z, tmpA.x),
        turnBy = Math.atan2(tmpB.z, tmpB.x) - from;
      const angle =
          from + Math.atan2(Math.sin(turnBy), Math.cos(turnBy)) * left,
        radius = THREE.MathUtils.lerp(
          Math.hypot(tmpA.x, tmpA.z),
          Math.hypot(tmpB.x, tmpB.z),
          left,
        );
      toeGoals[0].set(
        toeGoals[1].x + radius * Math.cos(angle),
        THREE.MathUtils.lerp(this.contactToes[0].y, this.standToes[0].y, left),
        toeGoals[1].z + radius * Math.sin(angle),
      );
      const followed = (side: number) =>
        THREE.MathUtils.smoothstep(
          landed,
          STEP_WINDOWS[side][1] - STEP_WEIGHT.follow[side][0],
          STEP_WINDOWS[side][1] + STEP_WEIGHT.follow[side][1],
        );
      tmpC
        .lerpVectors(this.contactToes[0], this.standToes[0], followed(0))
        .add(
          tmpD.lerpVectors(this.contactToes[1], this.standToes[1], followed(1)),
        )
        .multiplyScalar(0.5);
      loaded.root.updateWorldMatrix(true, true);
      loaded.toes[0].getWorldPosition(tmpA);
      loaded.toes[1].getWorldPosition(tmpB);
      loaded.root.position.add(tmpC.sub(tmpA.add(tmpB).multiplyScalar(0.5)));
      loaded.root.updateWorldMatrix(true, true);
      const px = stageScenePx();
      let roll = 0;
      loaded.hips.getWorldPosition(tmpA);
      for (let side = 0; side < 2; side++) {
        const [start, end] = STEP_WINDOWS[side];
        const onSupport =
          THREE.MathUtils.smoothstep(landed, start - STEP_WEIGHT.lead, start) *
          (1 - followed(side));
        if (onSupport === 0) continue;

        tmpB.subVectors(toeGoals[1 - side], tmpA).setY(0);
        const reach = Math.min(
          (STEP_WEIGHT.shift * px) / Math.max(Math.abs(tmpB.x), 1e-6),
          0.8,
        );
        const passing = Math.sin(
          Math.PI *
            THREE.MathUtils.clamp((landed - start) / (end - start), 0, 1),
        );
        loaded.root.position.addScaledVector(tmpB, reach * onSupport);
        loaded.root.position.y +=
          (STEP_WEIGHT.rise * passing - STEP_WEIGHT.drop * onSupport) * px;

        roll +=
          THREE.MathUtils.degToRad(STEP_WEIGHT.roll) *
          passing *
          (side ? 1 : -1);
      }
      loaded.root.updateWorldMatrix(true, true);
      if (roll && this.chestTwist.length) {
        tmpD.set(0, 0, 1).applyQuaternion(loaded.root.quaternion);
        twistWorld(loaded.hips, roll, tmpD);
        twistWorld(this.chestTwist[0], -roll, tmpD);
      }
      const kneeForward =
        THREE.MathUtils.degToRad(KNEE_FORWARD.roll) *
        THREE.MathUtils.smoothstep(
          landed,
          KNEE_FORWARD.start,
          KNEE_FORWARD.end,
        );
      toeGoals[0].y += STEP_LIFT * SWING_LIFT * Math.sin(Math.PI * left);
      toeGoals[1].y += STEP_LIFT * Math.sin(Math.PI * right);
      for (let side = 0; side < 2; side++) {
        const leg = this.legs[side];
        if (!leg) continue;
        plantFoot(leg, loaded.toes[side], toeGoals[side]);

        if (kneeForward > 0)
          rollKnee(
            leg,
            kneeForward,
            tmpD.set(0, 0, 1).applyQuaternion(loaded.root.quaternion),
          );
      }

      const sweep = this.strumYaw - this.profileYaw;
      const glance = THREE.MathUtils.smoothstep(
        landed,
        LANDED_GLANCE.start,
        LANDED_GLANCE.end,
      );
      const look =
        1 -
        (1 - (glance * THREE.MathUtils.degToRad(LANDED_GLANCE.yaw)) / sweep) *
          (1 -
            THREE.MathUtils.smoothstep(
              markerTime + TURN_LEAD.head,
              phases.turnStart,
              phases.turnEnd,
            ));
      for (const bone of this.chestTwist)
        twistWorld(bone, ((chest - body) * sweep) / this.chestTwist.length);
      for (const bone of this.headTwist)
        twistWorld(bone, ((look - chest) * sweep) / this.headTwist.length);
      if (this.headTwist.length) {
        const head = this.headTwist[this.headTwist.length - 1];
        head.quaternion.multiply(
          q.setFromAxisAngle(
            axis.set(1, 0, 0),
            -THREE.MathUtils.degToRad(LANDED_GLANCE.chin) * glance * (1 - body),
          ),
        );
        head.updateWorldMatrix(false, true);
      }
      if (landT >= 1) {
        loaded.root.scale.copy(loaded.baseScale);
        this.enter("strum");
      }
    }
    if (this.demo && this.state === "hop") {
      loaded.root.updateWorldMatrix(true, true);
      const pageY = (bone: THREE.Object3D) =>
        this.worldToPageY(bone.getWorldPosition(tmpA).y).toFixed(2);
      const data = this.host.dataset;
      data.hopSitPhase =
        elapsed < phases.pushStart
          ? "hang"
          : elapsed < phases.takeoff
            ? "push"
            : elapsed < contactAt
              ? "fall"
              : "landing";
      data.hopSitLeftToeX = this.worldToPageX(
        loaded.toes[0].getWorldPosition(tmpA).x,
      ).toFixed(2);
      data.hopSitRightToeX = this.worldToPageX(
        loaded.toes[1].getWorldPosition(tmpA).x,
      ).toFixed(2);
      data.hopSitHipY = pageY(loaded.hips);
      data.hopSitHipX = this.worldToPageX(
        loaded.hips.getWorldPosition(tmpA).x,
      ).toFixed(2);
      data.hopSitHeadY = this.worldToPageY(
        loaded.head.localToWorld(tmpB.copy(loaded.headCentre)).y,
      ).toFixed(2);
      data.hopSitLeftToeY = pageY(loaded.toes[0]);
      data.hopSitRightToeY = pageY(loaded.toes[1]);
      data.hopSitLeftHeelY = this.worldToPageY(
        loaded.heels[0].foot.localToWorld(tmpB.copy(loaded.heels[0].local)).y,
      ).toFixed(2);
      data.hopSitRightHeelY = this.worldToPageY(
        loaded.heels[1].foot.localToWorld(tmpB.copy(loaded.heels[1].local)).y,
      ).toFixed(2);
      if (loaded.arms) {
        data.hopSitLeftHandY = pageY(loaded.arms[0][2]);
        data.hopSitRightHandY = pageY(loaded.arms[1][2]);
        data.hopSitLeftHandX = this.worldToPageX(
          loaded.arms[0][2].getWorldPosition(tmpA).x,
        ).toFixed(2);
        data.hopSitRightHandX = this.worldToPageX(
          loaded.arms[1][2].getWorldPosition(tmpA).x,
        ).toFixed(2);
      }
    }
  }

  private reportNow(frameMs = 0) {
    const tracks = this.tracks();
    const trackIndex = tracks.length
      ? Math.min(this.trackIndex, tracks.length - 1)
      : 0;
    this.report({
      state: this.state,
      id: this.loaded?.metadata.id || "",
      bpm: this.bpm,
      distance: [...this.distance],
      frameMs,
      ready: !!this.loaded,
      trackTitle: tracks[trackIndex]?.title ?? "",
      trackIndex,
      trackCount: tracks.length,
      paused: this.paused,
      musicError: this.musicError || undefined,
      exiting: this.exiting,
    });
  }
  private cleanup() {
    if (!this.loaded) return;
    const loaded = this.loaded;
    loaded.mixer.stopAllAction();
    this.scene.remove(loaded.root);
    loaded.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    this.decal?.map.dispose();
    this.decal = null;
    this.loaded = null;
  }
  dispose() {
    this.disposed = true;
    this.setDemoMode(false);
    this.op++;
    cancelAnimationFrame(this.frame);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.observer.disconnect();
    this.stopMusic();
    this.releasePreparedTracks(new Error("Stage engine was disposed"));
    this.cleanup();
    this.renderer.dispose();
  }
}
