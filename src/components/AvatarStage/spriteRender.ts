import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const nameOf = (bone: THREE.Bone) =>
  bone.name.replace(/^mixamorig:?/, "").toLowerCase();
const vector = () => new THREE.Vector3();
const quaternion = () => new THREE.Quaternion();
const worldPosition = (bone: THREE.Object3D) => bone.getWorldPosition(vector());
const axisX = new THREE.Vector3(1, 0, 0);
const axisY = new THREE.Vector3(0, 1, 0);
const axisZ = new THREE.Vector3(0, 0, 1);
const childBone = (bone: THREE.Object3D) =>
  bone.children.find(
    (child): child is THREE.Bone => child instanceof THREE.Bone,
  );

const SPRITE = {
  width: 192,
  height: 268,
  headLeft: 50,
  headTop: 3,
  headHeight: 178,
  headMaxWidth: 175,
};

const GRIPS: readonly {
  row: number;
  inset: number;
  stack: number;
  pitch: number;
  girth: number[];
  roll: number[];
  dive: number;
  align: number[];
  shift: number[];
  depth: number;
  wrist?: [number, number];
  elbow?: [number, number];
}[] = [
  {
    row: 105,
    inset: 5,
    stack: 27,
    pitch: 11,
    girth: [1.2, 1.3, 1.1, 1.82],
    roll: [-15, 90, -30, 0],
    dive: 0.1,
    align: [1, 11.5, 1.5, 5],
    shift: [0, -1, 1, 0],
    depth: 0.1,
  },
  {
    row: 207,
    inset: 5,
    stack: 32,
    pitch: 11,
    girth: [1.5, 1.6, 1.71, 2.24],
    roll: [-30, 105, 0, -15],
    dive: 0.4,
    align: [0, 10.5, 3, 1.5],
    shift: [2, 0, 0, 1],
    depth: 0.05,
    wrist: [-24, 224],
    elbow: [51.45, 308.4],
  },
];

const SHIRT_PIECES: [number, number][][] = [
  [
    [204, 222],
    [161, 176],
    [150, 177],
    [146, 186],
    [145, 198],
    [148, 209],
    [153, 218],
    [192, 218],
  ],
  [
    [178, 171],
    [158, 175],
    [167, 183],
    [178, 171],
  ],
  [
    [194, 140],
    [160, 150],
    [160, 186],
    [194, 186],
    [194, 140],
  ],
  [
    [192, 212],
    [150, 212],
    [153, 218],
    [157, 224],
    [192, 224],
  ],
  [
    [192, 222],
    [156, 222],
    [163, 244],
    [171, 244],
    [184, 233],
    [196, 224],
  ],
];

const FOREARM_HEM: [number, number][] = [
  [194, 228],
  [158, 247],
];

const NECK_EDGE: [number, number][] = [
  [190, 150],
  [187, 153.5],
  [184, 157],
  [181.5, 160],
  [181, 163.5],
  [182.5, 166.5],
  [183.5, 167.5],
  [182, 169.5],
  [180, 171.5],
  [177, 174],
  [174.2, 176.2],
  [169, 178.4],
  [164, 180.5],
  [162, 182.5],
  [163, 185],
  [166, 187],
  [169, 190],
  [172, 192],
  [176, 194],
  [181, 197.5],
  [192, 203],
];

const BEARD_UNDERSIDE: [number, number][] = [
  [190.5, 150],
  [190, 153.5],
  [189, 156.5],
  [187.5, 160],
  [186.5, 163.5],
  [185, 165.5],
  [183.5, 167.5],
];

const BEARD_BOTTOM: [number, number][] = [
  [114, 161],
  [121, 167],
  [127, 169],
  [133, 174],
  [139, 177],
  [145, 179],
  [162, 180],
  [166, 178],
  [172, 176],
  [175, 175],
  [178, 172],
  [181, 169],
  [184, 165],
  [187, 160],
  [190, 151],
  [193, 146],
];

const BEARD_LIFT = {
  reach: 26,
  texture: 0.14,
  strength: 1,
  rgb: [242, 242, 240],
} satisfies {
  reach: number;
  texture: number;
  strength: number;
  rgb: [number, number, number];
};

type Crease = {
  line: [number, number][];
  width: number;
  gain: number;
  reach?: number;
  rgb?: [number, number, number];
};
type Shade = {
  rim: number;
  gain?: number;
  ramp?: [number, [number, number, number]][];
  field?: {
    x: number;
    row: number;
    step: number;
    columns: number;
    rgb: string;
  };
  creases: Crease[];
};

const NECK_FIELD = {
  x: 158,
  row: 148,
  step: 3,
  columns: 13,
  rgb: [
    "c17a4fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3f",
    "c98d67c17a4fbc734ca15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3f",
    "c98d67c17a4fc17a4fbc734ca15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3fa15b3f",
    "c98d67c98d67c17a4fc17a4fbc734cbc734ca15b3fa15b3fa15b3fa15b3fa15b3fa15b3f9e583b",
    "c98d67c98d67c98d67c17a4fc17a4fbc734cbc734cb46e4da15b3fa15b3fa15b3fa15b3f9e583b",
    "b87454c98d67c98d67c67b57c17a4fc17a4fbc734cbc734cb46e4db46e4da15c3f9e583b9e583b",
    "b87454c98d67c98d67c98d67c67b57c17a4fc17a4fbc734cbc734cb46e4da55e3c9c55329c5532",
    "b87454b87454c98d67c98d67c67b57c67b57c17a4fc17a4fbc734cbc724cac603ba55933a55933",
    "b87454b87454c98d67c98d67c98d67c67b57c67b57c17a4fb77047bf734dba6f48b86c46b86c46",
    "b87454b87454b87454c98d67c98d67d18c66c67b57c5784ebc7148c67952cd815ace825bce825b",
    "b87454b87454b87454cd885ec98d67d18c66d3855fcb7b55c3744dcd8159da8f66dc9068dc9068",
    "b87454b87454b87454cd885ed48e66d88e69dd8e69dd8e69d3855fd68a62df946ce1966ee1966e",
    "a86145a86145a86145ca7e59d88d6ade9771df9b72e49d76dc936cd88e68df956fdf956fe1966e",
    "a86145a86145a86145cb8363e09a7ae4a480e2a67ee5a47de5a47dd88e68df956fdf956fe1966e",
    "a86145a86145cb8363cb8363e29b7de4a17ce3a77fe3a77fe5a47dd88e68df956fdf956fdf956f",
    "a86145cb8363cb8363e29b7de29b7de4a17ce3a181e3a181e3a181e5a47ddf956fdf956fdf956f",
    "cb8363cb8363e29b7de29b7de29b7de3a181e3a181e3a181e3a181e3a181df956fdf956fdf956f",
    "cb8363e29b7de29b7de29b7de3a181e3a181e3a181e3a181e3a181e3a181e3a181df956fdf956f",
    "e29b7de29b7de29b7de29b7de3a181e3a181e3a181e3a181e3a181e3a181e3a181e3a181df956f",
  ].join(""),
};

const NECK_SHADE: Shade = {
  rim: 1,
  field: NECK_FIELD,
  creases: [
    {
      line: BEARD_UNDERSIDE.map(([x, row]) => [x - 2.75, row]),
      reach: 2,
      width: 1.2,
      gain: 1,
      rgb: [222, 219, 215],
    },
    { line: NECK_EDGE.slice(9), width: 1, gain: 0.7 },
    {
      line: [
        [192, 150],
        [192, 172],
      ],
      width: 0.8,
      gain: 0.62,
    },
    { line: NECK_EDGE.slice(0, 10), width: 1, gain: 0.92 },
    {
      line: [
        [179, 196.8],
        [183, 197.4],
        [192, 197.6],
      ],
      width: 1,
      gain: 1,
      rgb: [105, 66, 50],
    },
    {
      line: [
        [176, 197.5],
        [180, 199.5],
        [192, 200.5],
      ],
      width: 1.5,
      gain: 1,
      rgb: [200, 196, 196],
    },
  ],
};
const FOREARM_SHADE: Shade = {
  rim: 0.55,
  ramp: [
    [234, [205, 138, 100]],
    [256, [246, 192, 152]],
  ],
  creases: [],
};

const SLEEVE_SHADE: Shade = {
  rim: 0.8,
  gain: 1.06,
  creases: [
    {
      line: [
        [150, 199],
        [160, 207],
        [168, 213],
        [176, 218],
      ],
      width: 3.5,
      gain: 0.88,
    },
    {
      line: [
        [158, 223],
        [168, 223],
        [180, 221],
      ],
      width: 3.5,
      gain: 0.93,
    },
    {
      line: [
        [149, 190],
        [156, 194],
        [162, 197],
      ],
      width: 3,
      gain: 0.94,
    },
    {
      line: [
        [176, 170],
        [168, 176],
        [160, 180],
        [152, 186],
        [147, 192],
      ],
      width: 5,
      gain: 1,
      rgb: [222, 218, 220],
    },
    {
      line: [
        [150, 179],
        [146, 187],
        [145, 198],
        [148, 209],
      ],
      width: 3,
      gain: 0.97,
    },
    {
      line: [
        [148, 209],
        [153, 220],
        [158, 232],
        [162, 244],
        [171, 244],
      ],
      width: 3,
      gain: 0.86,
    },
  ],
};

const WRIST_ROW = 236;

const HAND_REACH = 24;

const SHRUG_DEGREES = 32;

function textureSampler(map: THREE.Texture | null) {
  const image = map?.image as
    (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!map || !image?.width) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return (u: number, v: number) => {
    const x = THREE.MathUtils.clamp(
      Math.floor(u * canvas.width),
      0,
      canvas.width - 1,
    );
    const y = THREE.MathUtils.clamp(
      Math.floor((map.flipY ? 1 - v : v) * canvas.height),
      0,
      canvas.height - 1,
    );
    const at = (y * canvas.width + x) * 4;
    return [data[at], data[at + 1], data[at + 2]] as const;
  };
}

const SUPERSAMPLE = 4;

const HAND_GRADE = [1.04, 1.01, 0.95];

const HEAD_BONES = /^(head|lefteye|righteye)/;

const HAND_BONES = /^(left|right)hand(?!thumb)/;
const FINGERS = ["index", "middle", "ring", "pinky"];

function setWorldQuaternion(bone: THREE.Object3D, world: THREE.Quaternion) {
  const parent = bone.parent!.getWorldQuaternion(quaternion());
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

function rotateWorld(
  bone: THREE.Object3D,
  axis: THREE.Vector3,
  degrees: number,
) {
  bone.updateWorldMatrix(true, false);
  const turn = quaternion().setFromAxisAngle(
    axis,
    THREE.MathUtils.degToRad(degrees),
  );
  setWorldQuaternion(
    bone,
    turn.multiply(bone.getWorldQuaternion(quaternion())),
  );
}

function aimJoint(
  joint: THREE.Bone,
  endpoint: THREE.Object3D,
  target: THREE.Vector3,
) {
  joint.updateWorldMatrix(true, true);
  const origin = worldPosition(joint);
  const current = worldPosition(endpoint).sub(origin).normalize();
  const desired = target.clone().sub(origin).normalize();
  if (current.lengthSq() < 1e-8 || desired.lengthSq() < 1e-8) return;
  const turn = quaternion().setFromUnitVectors(current, desired);
  setWorldQuaternion(
    joint,
    turn.multiply(joint.getWorldQuaternion(quaternion())),
  );
}

function frame(forward: THREE.Vector3, back: THREE.Vector3) {
  const f = forward.clone().normalize();
  const b = back
    .clone()
    .sub(f.clone().multiplyScalar(back.dot(f)))
    .normalize();
  return new THREE.Matrix4().makeBasis(f, vector().crossVectors(b, f), b);
}

function headBounds(root: THREE.Object3D, head: THREE.Bone) {
  const extent = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
  });
  root.traverse((node) => {
    if (
      !(node instanceof THREE.SkinnedMesh) ||
      !node.skeleton.bones.includes(head)
    )
      return;
    const joints = node.geometry.getAttribute("skinIndex");
    const weights = node.geometry.getAttribute("skinWeight");
    if (!joints || !weights) return;
    const point = vector();
    for (let vertex = 0; vertex < joints.count; vertex++) {
      let weight = 0;
      for (let slot = 0; slot < 4; slot++) {
        const bone = node.skeleton.bones[joints.getComponent(vertex, slot)];
        if (bone === head) weight += weights.getComponent(vertex, slot);
      }
      if (weight < 0.15) continue;
      node.getVertexPosition(vertex, point).applyMatrix4(node.matrixWorld);
      extent.expandByPoint(point);
    }
  });
  if (extent.isEmpty()) throw new Error("Rig has no skinned head vertices");
  return extent;
}

type Grip = {
  pitch: number;
  girth: readonly number[];
  roll: readonly number[];
  dive: number;
  align: readonly number[];
  shift: readonly number[];
  wristAt?: THREE.Vector3;
  elbowAt?: THREE.Vector3;
};

function gripEdge(
  bones: THREE.Bone[],
  side: "left" | "right",
  knuckles: THREE.Vector3,
  edgeX: number,
  stackHeight: number,
  pole: THREE.Vector3,
  grip: Grip,
) {
  const { elbowAt } = grip;
  const find = (name: string) => bones.find((bone) => nameOf(bone) === name);
  const shoulder = find(`${side}arm`),
    elbow = find(`${side}forearm`),
    hand = find(`${side}hand`);
  const chains = FINGERS.map((finger) => {
    const first = find(`${side}hand${finger}1`);
    const second = first && childBone(first),
      third = second && childBone(second);
    const tip = third && (childBone(third) ?? third);
    return first && second && third && tip
      ? ([first, second, third, tip] as const)
      : undefined;
  }).filter((chain) => chain !== undefined);
  if (!shoulder || !elbow || !hand || chains.length < 2) return undefined;
  hand.updateWorldMatrix(true, true);
  const span = worldPosition(chains[chains.length - 1][0]).distanceTo(
    worldPosition(chains[0][0]),
  );
  hand.scale.multiplyScalar(
    (stackHeight * (chains.length - 1)) / chains.length / span,
  );
  hand.updateWorldMatrix(false, true);

  const knuckleCentre = () =>
    chains
      .reduce((sum, chain) => sum.add(worldPosition(chain[0])), vector())
      .multiplyScalar(1 / chains.length);
  const lateral = worldPosition(chains[chains.length - 1][0])
    .sub(worldPosition(chains[0][0]))
    .normalize();
  const handForward = knuckleCentre().sub(worldPosition(hand));
  handForward.sub(lateral.clone().multiplyScalar(handForward.dot(lateral)));
  const back =
    side === "left"
      ? vector().crossVectors(handForward, lateral)
      : vector().crossVectors(lateral, handForward);
  const current = frame(handForward, back);
  const gripForward = vector().set(-1, 0, 0),
    gripBack = vector().set(0.2, 0, 1);
  const desired = frame(gripForward, gripBack);
  const turn = quaternion().setFromRotationMatrix(
    desired.multiply(current.invert()),
  );
  const gripWorld = turn.multiply(hand.getWorldQuaternion(quaternion()));
  setWorldQuaternion(hand, gripWorld);

  chains.forEach((chain, index) =>
    chain[0].scale.setScalar(grip.girth[index] ?? 1),
  );
  hand.updateWorldMatrix(false, true);

  const palmWorld = gripBack
    .clone()
    .sub(gripForward.clone().multiplyScalar(gripBack.dot(gripForward)))
    .normalize()
    .negate();
  const palms = chains.map((chain) =>
    [0, 1, 2].map((joint) =>
      palmWorld
        .clone()
        .applyQuaternion(
          chain[joint].getWorldQuaternion(quaternion()).invert(),
        ),
    ),
  );
  const curlAxis = vector().crossVectors(gripBack, gripForward).normalize();
  const thumb = find(`${side}handthumb1`);
  if (thumb) rotateWorld(thumb, curlAxis, 35);

  shoulder.updateWorldMatrix(true, true);
  const wrist =
    grip.wristAt?.clone() ??
    knuckles.clone().sub(knuckleCentre().sub(worldPosition(hand)));
  const origin = worldPosition(shoulder);
  const upper = origin.distanceTo(worldPosition(elbow)),
    lower = worldPosition(elbow).distanceTo(worldPosition(hand));
  const toWrist = wrist.clone().sub(origin);
  const reach = THREE.MathUtils.clamp(
    toWrist.length(),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  const along = toWrist.normalize();
  const bend = pole
    .clone()
    .sub(along.clone().multiplyScalar(pole.dot(along)))
    .normalize();
  const cosine =
    (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);

  const elbowWorld = elbowAt
    ? wrist
        .clone()
        .add(elbowAt.clone().sub(wrist).normalize().multiplyScalar(lower))
    : undefined;
  const elbowTarget =
    elbowWorld ??
    origin
      .clone()
      .add(along.clone().multiplyScalar(upper * cosine))
      .add(
        bend.multiplyScalar(
          upper * Math.sqrt(Math.max(0, 1 - cosine * cosine)),
        ),
      );
  aimJoint(shoulder, elbow, elbowTarget);
  shoulder.updateWorldMatrix(false, true);
  if (elbowWorld) {
    elbow.position.copy(elbow.parent!.worldToLocal(elbowWorld.clone()));
    elbow.updateWorldMatrix(false, true);
  }
  aimJoint(
    elbow,
    hand,
    elbowWorld ? wrist : origin.clone().add(along.multiplyScalar(reach)),
  );
  elbow.updateWorldMatrix(false, true);
  setWorldQuaternion(hand, gripWorld);
  const target = knuckles.clone();

  const wristMatrix = hand.matrixWorld.clone();

  const residual = target.clone().sub(knuckleCentre());
  hand.position.copy(
    hand.parent!.worldToLocal(worldPosition(hand).add(residual)),
  );
  hand.updateWorldMatrix(false, true);
  const error = knuckleCentre().distanceTo(target);

  const stackY = knuckleCentre().y;

  const orient = (
    joint: THREE.Bone,
    endpoint: THREE.Object3D,
    direction: THREE.Vector3,
    palmLocal: THREE.Vector3,
  ) => {
    const along = endpoint.position.clone().normalize();
    const palm = palmLocal
      .clone()
      .sub(along.clone().multiplyScalar(palmLocal.dot(along)))
      .normalize();
    const local = new THREE.Matrix4().makeBasis(
      along,
      palm,
      vector().crossVectors(along, palm),
    );
    const forward = direction.clone().normalize(),
      palmar = vector().crossVectors(forward, axisY).normalize();
    const world = new THREE.Matrix4().makeBasis(
      forward,
      palmar,
      vector().crossVectors(forward, palmar),
    );
    setWorldQuaternion(
      joint,
      quaternion().setFromRotationMatrix(world.multiply(local.transpose())),
    );
  };
  const order = Math.sign(worldPosition(chains[0][0]).y - stackY || 1);
  const rowY = (index: number) =>
    stackY +
    ((chains.length / 2 - 0.5 - index) * grip.pitch -
      (grip.shift[index] ?? 0)) *
      order;
  const fold = [vector().set(0, 0, -1), vector().set(1, 0, -0.3)];
  chains.forEach((chain, index) => {
    const knuckle = worldPosition(chain[0]);
    if (grip.align.length)
      chain[0].position.copy(
        chain[0].parent!.worldToLocal(
          vector().set(edgeX + grip.align[index], rowY(index), knuckle.z),
        ),
      );
    chain[0].updateWorldMatrix(false, true);
    const roll = grip.roll[index] ?? 0;
    [vector().set(-1, 0, -grip.dive), ...fold].forEach((direction, joint) => {
      orient(chain[joint], chain[joint + 1], direction, palms[index][joint]);
      if (roll) rotateWorld(chain[joint], direction.clone().normalize(), roll);
    });
  });
  return {
    error,
    hand,
    wristMatrix,
    tips: chains.map((chain) => worldPosition(chain[3])),
    knuckles: chains.map((chain) => worldPosition(chain[0])),
    joints: chains.map((chain) => [chain[1], chain[2]].map(worldPosition)),
    wrist: worldPosition(hand),
  };
}

export async function renderPeekSprite(
  canvas: HTMLCanvasElement,
  id: string,
  layer: "body" | "hands",
) {
  const glCanvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(
    SPRITE.width * SUPERSAMPLE,
    SPRITE.height * SUPERSAMPLE,
    false,
  );
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff5e9, 0x798695, 2.2));
  const key = new THREE.DirectionalLight(0xfff5e6, 2.2);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc0dae9, 1.4);
  rim.position.set(1, 2, -2);
  scene.add(rim);
  const root = (
    await loader.loadAsync(`/avatars/${encodeURIComponent(id)}/avatar.glb`)
  ).scene;
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  root.scale.multiplyScalar(1 / height);
  root.position.y -= bounds.min.y / height;
  root.updateWorldMatrix(true, true);
  const bones: THREE.Bone[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Bone) bones.push(node);
  });
  const find = (name: string) => bones.find((bone) => nameOf(bone) === name);
  const hips = find("hips"),
    head = find("head"),
    neck = find("neck");
  const left = find("leftshoulder"),
    right = find("rightshoulder");
  const lt = find("lefttoebase"),
    rt = find("righttoebase");
  if (!hips || !head || !neck || !left || !right || !lt || !rt)
    throw new Error(`Incomplete peek rig: ${id}`);
  const up = worldPosition(head).sub(worldPosition(hips)).normalize();
  const lateral = worldPosition(right).sub(worldPosition(left)).normalize();
  const forward = vector().crossVectors(up, lateral).setY(0).normalize();
  const toe = worldPosition(lt)
    .add(worldPosition(rt))
    .multiplyScalar(0.5)
    .sub(worldPosition(hips))
    .setY(0);
  if (forward.dot(toe) < 0) forward.negate();

  const restHead = head.getWorldQuaternion(quaternion()).invert();
  const faceLocal = forward.clone().applyQuaternion(restHead);
  const crownLocal = axisY.clone().applyQuaternion(restHead);

  root.rotation.y = -Math.PI / 3 - Math.atan2(forward.x, forward.z);
  root.updateWorldMatrix(true, true);
  const torso = [find("spine"), find("spine1"), find("spine2")];

  for (const [bone, degrees] of [
    [torso[1], 12],
    [torso[2], -8],
    [neck, 33],
    [head, -3],
  ] as const) {
    if (bone) rotateWorld(bone, axisZ, degrees);
  }
  for (const [bone, degrees] of [
    [torso[2], 9],
    [neck, 27],
    [head, 29],
  ] as const) {
    if (bone) rotateWorld(bone, axisY, degrees);
  }

  rotateWorld(neck, axisX, -12);
  rotateWorld(head, axisX, -29);
  rotateWorld(head, axisZ, 4);

  rotateWorld(head, axisY, 4);
  root.updateWorldMatrix(true, true);
  const headWorld = head.getWorldQuaternion(quaternion());
  const face = faceLocal.clone().applyQuaternion(headWorld);
  const crown = crownLocal.clone().applyQuaternion(headWorld);
  const extent = headBounds(root, head);
  const unitsPerPixel = Math.max(
    (extent.max.y - extent.min.y) / SPRITE.headHeight,
    (extent.max.x - extent.min.x) / SPRITE.headMaxWidth,
  );
  const crownY = extent.max.y + SPRITE.headTop * unitsPerPixel;
  const edgeX = extent.min.x + (SPRITE.width - SPRITE.headLeft) * unitsPerPixel;
  const toPixel = (point: THREE.Vector3) => [
    (point.x - edgeX) / unitsPerPixel + SPRITE.width,
    (crownY - point.y) / unitsPerPixel,
  ];

  const sides: ("left" | "right")[] =
    worldPosition(find("leftarm")!).x < worldPosition(find("rightarm")!).x
      ? ["left", "right"]
      : ["right", "left"];

  const edgeShoulder = find(`${sides[1]}shoulder`),
    edgeArm = find(`${sides[1]}arm`);
  if (edgeShoulder && edgeArm) {
    const clavicle = worldPosition(edgeArm).sub(worldPosition(edgeShoulder));
    rotateWorld(edgeShoulder, clavicle.cross(axisY).normalize(), SHRUG_DEGREES);
  }

  let lowerWrist: { bone: THREE.Bone; matrix: THREE.Matrix4 } | undefined;
  const solveGrip = (side: "left" | "right", index: number) => {
    const spec = GRIPS[index];
    const knuckles = vector().set(
      edgeX + spec.inset * unitsPerPixel,
      crownY - spec.row * unitsPerPixel,
      worldPosition(head).z + 0.08 + spec.depth,
    );
    const toWorld = ([x, y]: readonly number[]) =>
      vector().set(
        edgeX + x * unitsPerPixel,
        crownY - y * unitsPerPixel,
        knuckles.z,
      );

    const pole =
      index === 0 ? vector().set(0, -1, -0.3) : vector().set(-0.3, -1, 0.2);
    const grip = gripEdge(
      bones,
      side,
      knuckles,
      edgeX,
      spec.stack * unitsPerPixel,
      pole,
      {
        pitch: spec.pitch * unitsPerPixel,
        girth: spec.girth,
        roll: spec.roll,
        dive: spec.dive,
        align: spec.align.map((value) => value * unitsPerPixel),
        shift: spec.shift.map((value) => value * unitsPerPixel),
        wristAt: spec.wrist ? toWorld(spec.wrist) : undefined,
        elbowAt: spec.elbow ? toWorld(spec.elbow) : undefined,
      },
    );
    if (!grip) throw new Error(`Incomplete ${side} hand: ${id}`);
    return grip;
  };
  const hands = sides.map((side, index) => {
    const grip = solveGrip(side, index);
    if (index === 1) lowerWrist = { bone: grip.hand, matrix: grip.wristMatrix };
    return {
      side,
      row: GRIPS[index].row,
      errorPx: grip.error / unitsPerPixel,
      knuckles: grip.knuckles.map(toPixel),
      joints: grip.joints.map((pair) => pair.map(toPixel)),
      tips: grip.tips.map(toPixel),
      wrist: toPixel(grip.wrist),
    };
  });
  root.updateWorldMatrix(true, true);

  root.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    const { skeleton } = node;
    for (const side of sides) {
      const middle = skeleton.bones.findIndex(
        (bone) => nameOf(bone) === `${side}handmiddle3`,
      );
      const ring = skeleton.bones.findIndex(
        (bone) => nameOf(bone) === `${side}handring3`,
      );
      if (middle < 0 || ring < 0) continue;
      const bone = skeleton.bones[middle];
      const world = skeleton.bones[ring].matrixWorld
        .clone()
        .multiply(skeleton.boneInverses[ring])
        .multiply(skeleton.boneInverses[middle].clone().invert());
      bone
        .parent!.matrixWorld.clone()
        .invert()
        .multiply(world)
        .decompose(bone.position, bone.quaternion, bone.scale);
      bone.updateWorldMatrix(false, true);
    }
  });
  const camera = new THREE.OrthographicCamera(
    edgeX - SPRITE.width * unitsPerPixel,
    edgeX,
    crownY,
    crownY - SPRITE.height * unitsPerPixel,
    0.01,
    30,
  );
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();

  const shirtBones = new Set([`${sides[1]}shoulder`, `${sides[1]}arm`]);

  const chinLift = Math.max(
    0,
    SPRITE.headTop +
      SPRITE.headHeight -
      (crownY - extent.min.y) / unitsPerPixel,
  );
  const outlinePoint = ([x, row]: [number, number]) =>
    vector().set(
      edgeX - (SPRITE.width - x) * unitsPerPixel,
      crownY - row * unitsPerPixel,
      0,
    );

  const outlinePlanes = (points: [number, number][]) =>
    points.slice(1).map((end, index) => {
      const from = outlinePoint(points[index]),
        to = outlinePoint(end);
      return new THREE.Plane().setFromNormalAndCoplanarPoint(
        vector()
          .set(from.y - to.y, to.x - from.x, 0)
          .normalize(),
        from,
      );
    });
  const shirtPieces = SHIRT_PIECES.map((piece) =>
    outlinePlanes(
      piece.map(([x, row]): [number, number] => [
        x,
        row < 190 ? row - chinLift : row,
      ]),
    ),
  );
  const forearmPlanes = outlinePlanes(FOREARM_HEM);
  const neckBands = NECK_EDGE.slice(1).map(([x, row], index) => {
    const [fromX, fromRow] = NECK_EDGE[index];
    return outlinePlanes([
      [SPRITE.width + 2, fromRow],
      [fromX, fromRow],
      [x, row],
      [SPRITE.width + 2, row],
      [SPRITE.width + 2, fromRow],
    ]);
  });
  renderer.localClippingEnabled = true;
  const triangleCounts: number[] = [];
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) meshes.push(node);
  });
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    mesh.skeleton.update();
    const source = mesh.geometry;
    const indices = source.index;
    const skinIndex = source.getAttribute("skinIndex"),
      skinWeight = source.getAttribute("skinWeight");
    if (!skinIndex || !skinWeight) continue;
    const position = source.getAttribute("position");
    const count = indices ? indices.count : position.count;

    const group = new Uint8Array(position.count);
    const throat = new Uint8Array(position.count);
    const palm = new Uint8Array(position.count);
    const lowerPalm = new Uint8Array(position.count);
    for (let offset = 0; offset < position.count; offset++) {
      let strongest = -1,
        dominant = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = skinWeight.getComponent(offset, slot);
        if (weight > strongest) {
          strongest = weight;
          dominant = skinIndex.getComponent(offset, slot);
        }
      }
      const name = nameOf(mesh.skeleton.bones[dominant]);
      group[offset] = HAND_BONES.test(name)
        ? 1
        : HEAD_BONES.test(name)
          ? 2
          : shirtBones.has(name) || /^(spine\d?|hips)$/.test(name)
            ? 3
            : name === `${sides[1]}forearm`
              ? 4
              : 0;
      throat[offset] = Number(
        /^(neck|spine\d?|(left|right)shoulder)$/.test(name),
      );

      palm[offset] = Number(/^(left|right)(hand|forearm)$/.test(name));
      lowerPalm[offset] = Number(name === `${sides[1]}hand`);
    }
    const kept: number[] = [],
      shirt: number[] = [],
      forearm: number[] = [],
      neckPart: number[] = [];
    for (let offset = 0; offset < count; offset += 3) {
      const corners = [0, 1, 2].map((corner) =>
        indices ? indices.getX(offset + corner) : offset + corner,
      );
      const hand = corners.filter((index) => group[index] === 1).length >= 2;
      if (layer === "hands") {
        if (hand) kept.push(...corners);
        continue;
      }

      if (hand && corners.filter((index) => lowerPalm[index]).length >= 2)
        forearm.push(...corners);
      else if (hand) continue;
      else if (corners.some((index) => group[index] === 2))
        kept.push(...corners);
      else if (
        corners.some((index) => group[index] === 4) &&
        corners.every((index) => group[index] > 0)
      )
        forearm.push(...corners);
      else if (corners.every((index) => group[index] === 3))
        shirt.push(...corners);

      if (corners.every((index) => throat[index] || group[index] === 3))
        neckPart.push(...corners);
    }
    triangleCounts.push(
      (kept.length + shirt.length + forearm.length + neckPart.length) / 3,
    );
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const copy = material.clone();
    copy.side = THREE.DoubleSide;
    if (layer === "hands") {
      copy.clippingPlanes = [
        new THREE.Plane(
          new THREE.Vector3(1, 0, 0),
          -(edgeX - HAND_REACH * unitsPerPixel),
        ),
        new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -(crownY - WRIST_ROW * unitsPerPixel),
        ),
      ];
    }
    const uv = source.getAttribute("uv")?.clone();
    const texel =
      copy instanceof THREE.MeshStandardMaterial
        ? textureSampler(copy.map)
        : undefined;
    if (uv && texel) {
      const isSkin = (index: number) => {
        const [red, green, blue] = texel(uv.getX(index), uv.getY(index));
        return red > 140 && red - blue > 45 && red >= green && green > blue;
      };

      const shirtVertices = [...new Set(shirt)].filter(
        (index) => group[index] === 3,
      );
      const cloth = shirtVertices.filter((index) => {
        const [red, green, blue] = texel(uv.getX(index), uv.getY(index));
        return (
          Math.min(red, green, blue) > 170 &&
          Math.max(red, green, blue) - Math.min(red, green, blue) < 30
        );
      });
      if (cloth.length)
        for (const index of shirtVertices.filter(isSkin)) {
          const at = vector().fromBufferAttribute(position, index);
          const near = cloth.reduce((best, other) =>
            vector()
              .fromBufferAttribute(position, other)
              .distanceToSquared(at) <
            vector().fromBufferAttribute(position, best).distanceToSquared(at)
              ? other
              : best,
          );
          uv.setXY(index, uv.getX(near), uv.getY(near));
        }

      for (const index of forearm) palm[index] = 1;
      const palmVertices: number[] = [],
        skinVertices: number[] = [];
      for (let offset = 0; offset < position.count; offset++) {
        if (!palm[offset]) continue;
        palmVertices.push(offset);
        if (isSkin(offset)) skinVertices.push(offset);
      }
      if (skinVertices.length) {
        const centre = palmVertices
          .reduce(
            (sum, offset) =>
              sum.add(vector().fromBufferAttribute(position, offset)),
            vector(),
          )
          .multiplyScalar(1 / palmVertices.length);
        const skin = skinVertices.reduce((best, offset) =>
          vector()
            .fromBufferAttribute(position, offset)
            .distanceToSquared(centre) <
          vector().fromBufferAttribute(position, best).distanceToSquared(centre)
            ? offset
            : best,
        );
        for (const offset of palmVertices)
          uv.setXY(offset, uv.getX(skin), uv.getY(skin));
      }
      source.setAttribute("uv", uv);
    }
    for (const [list, planes] of [
      ...shirtPieces.map((planes) => [shirt, planes] as const),
      [forearm, forearmPlanes] as const,
      ...neckBands.map((planes) => [neckPart, planes] as const),
    ]) {
      if (!list.length) continue;
      const clipped = copy.clone();
      clipped.clippingPlanes = [...planes];

      const order = list === forearm ? 3 : list === neckPart ? 1 : 0;
      if (order) {
        clipped.depthTest = false;
        clipped.side = THREE.FrontSide;
      }
      if (list === neckPart) clipped.depthWrite = false;

      const {
        rim,
        gain = 1,
        ramp,
        field,
        creases,
      } = list === neckPart
        ? NECK_SHADE
        : list === forearm
          ? FOREARM_SHADE
          : SLEEVE_SHADE;
      const colour = (rgb: [number, number, number]) =>
        `vec3(${rgb.map((channel) => (channel / 255).toFixed(4)).join(", ")})`;
      const form =
        list === shirt
          ? "smoothstep(0.2, 0.9, abs(normal.z))"
          : "smoothstep(0.0, 0.85, abs(normal.z))";

      const fieldColours = field?.rgb
        .match(/.{6}/g)!
        .map((hex) =>
          colour([
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ]),
        );
      const paint =
        field && fieldColours
          ? `const vec3 field[${fieldColours.length}] = vec3[](${fieldColours.join(", ")});
          vec2 cell = clamp((shadePixel - vec2(${field.x.toFixed(1)}, ${field.row.toFixed(1)})) / ${field.step.toFixed(1)}, vec2(0.0), vec2(${(field.columns - 1).toFixed(1)}, ${(fieldColours.length / field.columns - 1).toFixed(1)}) - 0.001);
          ivec2 corner = ivec2(floor(cell)); vec2 blend = fract(cell);
          int at = corner.y * ${field.columns} + corner.x;
          gl_FragColor.rgb = mix(mix(field[at], field[at + 1], blend.x), mix(field[at + ${field.columns}], field[at + ${field.columns + 1}], blend.x), blend.y);`
          : ramp
            ? `vec3 ramp = ${colour(ramp[0][1])};
          ${ramp
            .slice(1)
            .map(
              ([row, rgb], index) =>
                `ramp = mix(ramp, ${colour(rgb)}, smoothstep(${ramp[index][0].toFixed(1)}, ${row.toFixed(1)}, shadeRow));`,
            )
            .join("\n")}
          gl_FragColor.rgb = mix(${colour(ramp[0][1])}, ramp, mix(${rim.toFixed(3)}, 1.0, ${form}));`
            : `gl_FragColor.rgb *= ${gain.toFixed(3)} * mix(${rim.toFixed(3)}, 1.0, ${form});`;

      const folds = creases
        .map(({ line, width, gain, reach = 0, rgb }) => {
          const segments = line
            .slice(1)
            .map(([x, row], index) => {
              const [fromX, fromRow] = line[index];
              return `{ vec2 a = vec2(${fromX.toFixed(1)}, ${fromRow.toFixed(1)}), ab = vec2(${(x - fromX).toFixed(1)}, ${(row - fromRow).toFixed(1)});
            near = min(near, length(shadePixel - a - ab * clamp(dot(shadePixel - a, ab) / dot(ab, ab), 0.0, 1.0))); }`;
            })
            .join("\n");
          const weight = `smoothstep(${reach.toFixed(2)}, ${(reach + width).toFixed(2)}, near)`;
          return `{ float near = 1e4;
          ${segments}
          ${rgb ? `gl_FragColor.rgb = mix(${colour(rgb)}, gl_FragColor.rgb, mix(1.0 - ${gain.toFixed(3)}, 1.0, ${weight}));` : `gl_FragColor.rgb *= mix(${gain.toFixed(3)}, 1.0, ${weight});`} }`;
        })
        .join("\n");
      clipped.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <colorspace_fragment>",
          `#include <colorspace_fragment>
          vec2 shadePixel = vec2(gl_FragCoord.x, ${(SPRITE.height * SUPERSAMPLE).toFixed(1)} - gl_FragCoord.y) / ${SUPERSAMPLE.toFixed(1)};
          float shadeRow = shadePixel.y;
          ${paint}
          ${folds}`,
        );
      };
      const geometry = source.clone();
      geometry.setIndex(list);
      geometry.clearGroups();
      const part = new THREE.SkinnedMesh(geometry, clipped);
      part.frustumCulled = false;
      part.renderOrder = order;
      part.position.copy(mesh.position);
      part.quaternion.copy(mesh.quaternion);
      part.scale.copy(mesh.scale);
      mesh.parent!.add(part);

      const fixedPose =
        list === forearm && lowerWrist
          ? [{ bone: lowerWrist.bone, matrix: lowerWrist.matrix }]
          : [];
      if (fixedPose.length) {
        const skeletonBones = mesh.skeleton.bones.map((bone) => {
          const pose = fixedPose.find((entry) => entry.bone === bone);
          if (!pose) return bone;
          const fixed = new THREE.Bone();
          fixed.matrixAutoUpdate = false;
          fixed.matrixWorld.copy(pose.matrix);
          return fixed;
        });
        part.bind(
          new THREE.Skeleton(skeletonBones, mesh.skeleton.boneInverses),
          mesh.bindMatrix,
        );
      } else part.bind(mesh.skeleton, mesh.bindMatrix);
    }
    mesh.geometry = source.clone();
    mesh.renderOrder = 2;
    mesh.geometry.setIndex(kept);
    mesh.geometry.clearGroups();
    if (layer === "body")
      copy.onBeforeCompile = (shader) => {
        const edge = BEARD_BOTTOM.slice(1)
          .map(([x, row], index) => {
            const [fromX, fromRow] = BEARD_BOTTOM[index];
            return `if (shadePixel.x >= ${fromX.toFixed(1)} && shadePixel.x < ${x.toFixed(1)}) edge = mix(${fromRow.toFixed(1)}, ${row.toFixed(1)}, (shadePixel.x - ${fromX.toFixed(1)}) / ${(x - fromX).toFixed(1)});`;
          })
          .join("\n");
        const { reach, texture, strength, rgb } = BEARD_LIFT;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <colorspace_fragment>",
          `#include <colorspace_fragment>
        vec2 shadePixel = vec2(gl_FragCoord.x, ${(SPRITE.height * SUPERSAMPLE).toFixed(1)} - gl_FragCoord.y) / ${SUPERSAMPLE.toFixed(1)};
        float edge = -1.0;
        ${edge}
        vec3 beard = gl_FragColor.rgb;
        float grey = 1.0 - smoothstep(0.06, 0.16, max(beard.r, max(beard.g, beard.b)) - min(beard.r, min(beard.g, beard.b)));
        if (edge > 0.0 && grey > 0.5 && shadePixel.x > 164.0 && shadePixel.y > edge + 0.5) discard;
        float lift = edge > 0.0 ? grey * ${strength.toFixed(3)} * (1.0 - smoothstep(0.0, ${reach.toFixed(1)}, edge - shadePixel.y)) : 0.0;
        gl_FragColor.rgb = mix(beard, ${`vec3(${rgb.map((channel) => (channel / 255).toFixed(4)).join(", ")})`} * (1.0 - ${texture.toFixed(3)} * (1.0 - beard)), lift);`,
        );
      };
    mesh.material = copy;
  }
  scene.add(root);
  renderer.render(scene, camera);

  const full = document.createElement("canvas");
  full.width = glCanvas.width;
  full.height = glCanvas.height;
  const fullContext = full.getContext("2d", { willReadFrequently: true })!;
  fullContext.drawImage(glCanvas, 0, 0);
  const source = fullContext.getImageData(0, 0, full.width, full.height).data;
  const context = canvas.getContext("2d")!;
  const sprite = context.createImageData(SPRITE.width, SPRITE.height);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const [redGain, greenGain, blueGain] =
    layer === "hands" ? HAND_GRADE : [1, 1, 1];
  for (let y = 0; y < SPRITE.height; y++) {
    for (let x = 0; x < SPRITE.width; x++) {
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const at =
            ((y * SUPERSAMPLE + sy) * full.width + x * SUPERSAMPLE + sx) * 4;
          const weight = source[at + 3];
          red += source[at] * weight;
          green += source[at + 1] * weight;
          blue += source[at + 2] * weight;
          alpha += weight;
        }
      }
      const at = (y * SPRITE.width + x) * 4;
      if (alpha > 0) {
        sprite.data[at] = (red / alpha) * redGain;
        sprite.data[at + 1] = (green / alpha) * greenGain;
        sprite.data[at + 2] = (blue / alpha) * blueGain;
      }
      sprite.data[at + 3] = alpha / samples;
    }
  }
  context.putImageData(sprite, 0, 0);
  renderer.dispose();
  const eyes = (["lefteye", "righteye"] as const)
    .map((name) => find(name))
    .filter((eye) => eye !== undefined)
    .map((eye) => toPixel(worldPosition(eye)));
  const [left0, top0] = toPixel(vector().set(extent.min.x, extent.max.y, 0));
  const [right0, bottom0] = toPixel(
    vector().set(extent.max.x, extent.min.y, 0),
  );
  const metrics = {
    headBBox: [left0, top0, right0, bottom0],
    headForward: face.toArray(),
    headForwardZ: face.z,
    headRollDeg: THREE.MathUtils.radToDeg(Math.atan2(-crown.x, crown.y)),
    headPitchDeg: THREE.MathUtils.radToDeg(Math.asin(face.y)),
    fingertips: hands.flatMap((hand) =>
      hand.tips.map(([x]) => SPRITE.width - x),
    ),
    eyes,
    eyeLineDeg:
      eyes.length === 2
        ? Math.abs(
            THREE.MathUtils.radToDeg(
              Math.atan2(eyes[1][1] - eyes[0][1], eyes[1][0] - eyes[0][0]),
            ),
          )
        : undefined,
    hands,
    triangleCounts,
  };
  const pose = {
    version: 1,
    root: {
      position: root.position.toArray(),
      quaternion: root.quaternion.toArray(),
      scale: root.scale.toArray(),
    },
    bones: Object.fromEntries(
      bones.map((bone) => [
        bone.name,
        {
          position: bone.position.toArray(),
          quaternion: bone.quaternion.toArray(),
          scale: bone.scale.toArray(),
        },
      ]),
    ),
    camera: {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
    },
    headBounds: [extent.min.x, extent.min.y, extent.max.x, extent.max.y],
    pixelsPerUnit: 1 / unitsPerPixel,
    handTargets: GRIPS.map((grip) => grip.row),
    metrics,
  };
  document.documentElement.dataset.spriteReady = "true";
  return pose;
}
