import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from "three";
import type { Material } from "three";
import type { Appearance, BodyProportions, CharacterRig } from "./types";

const SIDES = ["left", "right"] as const;
const RADIAL_SEGMENTS = 12;
export const HAND_KNUCKLE_OFFSET_RATIO = 0.42;
const FINGER_LENGTHS = [0.32, 0.44, 0.48, 0.44, 0.36] as const;
const FINGER_X = [-0.42, -0.27, -0.08, 0.11, 0.29] as const;
const PROPORTION_FIELDS: ReadonlyArray<keyof BodyProportions> = [
  "chestWidth",
  "chestDepth",
  "bellyWidth",
  "bellyDepth",
  "torsoLength",
  "shoulderWidth",
  "shoulderSlope",
  "neckWidth",
  "neckLength",
  "upperArmLength",
  "forearmLength",
  "upperArmRadius",
  "forearmRadius",
  "handSize",
  "shirtClearance",
];

function assertFinitePositive(name: keyof BodyProportions, value: number): void {
  const permitsZero = name === "shoulderSlope";
  if (!Number.isFinite(value) || (permitsZero ? value < 0 : value <= 0)) {
    const range = permitsZero ? "zero or greater" : "greater than zero";
    throw new RangeError(`proportions.${name} must be a finite number ${range}`);
  }
}

export function validateBodyProportions(proportions: BodyProportions): void {
  for (const name of PROPORTION_FIELDS) {
    assertFinitePositive(name, proportions[name]);
  }
  if (proportions.neckWidth >= proportions.shoulderWidth) {
    throw new RangeError("proportions.neckWidth must be less than proportions.shoulderWidth");
  }
}

function validateAppearance(appearance: Appearance): void {
  if (appearance.skin.trim().length === 0) {
    throw new TypeError("appearance.skin must be a non-empty color string");
  }
  if (appearance.shirt.trim().length === 0) {
    throw new TypeError("appearance.shirt must be a non-empty color string");
  }
}

type ProfileRing = {
  y: number;
  radiusX: number;
  radiusZ: number;
  bones: readonly [primary: number, secondary: number];
  primaryWeight: number;
};

function setSkinAttributes(
  geometry: BufferGeometry,
  rings: readonly ProfileRing[],
  capTop: boolean,
  capBottom: boolean,
): void {
  const ringVertexCount = rings.length * RADIAL_SEGMENTS;
  const capRings: ProfileRing[] = [];
  if (capTop) capRings.push(rings[0]);
  if (capBottom) capRings.push(rings[rings.length - 1]);
  const count = ringVertexCount + capRings.length;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let vertex = 0; vertex < ringVertexCount; vertex += 1) {
    const ring = rings[Math.floor(vertex / RADIAL_SEGMENTS)];
    indices[vertex * 4] = ring.bones[0];
    indices[vertex * 4 + 1] = ring.bones[1];
    weights[vertex * 4] = ring.primaryWeight;
    weights[vertex * 4 + 1] = 1 - ring.primaryWeight;
  }
  for (let cap = 0; cap < capRings.length; cap += 1) {
    const vertex = ringVertexCount + cap;
    const ring = capRings[cap];
    indices[vertex * 4] = ring.bones[0];
    indices[vertex * 4 + 1] = ring.bones[1];
    weights[vertex * 4] = ring.primaryWeight;
    weights[vertex * 4 + 1] = 1 - ring.primaryWeight;
  }
  geometry.setAttribute("skinIndex", new BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(weights, 4));
}

function createWeightedProfileGeometry(rings: readonly ProfileRing[], caps: boolean | "top" = true): BufferGeometry {
  if (rings.length < 2) throw new RangeError("A profile requires at least two rings");
  const capTop = caps === true || caps === "top";
  const capBottom = caps === true;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const ring of rings) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const angle = (segment / RADIAL_SEGMENTS) * Math.PI * 2;
      vertices.push(Math.cos(angle) * ring.radiusX, ring.y, Math.sin(angle) * ring.radiusZ);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      const top = ring * RADIAL_SEGMENTS;
      const bottom = (ring + 1) * RADIAL_SEGMENTS;
      indices.push(top + segment, top + next, bottom + segment);
      indices.push(top + next, bottom + next, bottom + segment);
    }
  }
  if (capTop) {
    const topCenter = vertices.length / 3;
    vertices.push(0, rings[0].y, 0);
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      indices.push(topCenter, next, segment);
    }
  }
  if (capBottom) {
    const bottomCenter = vertices.length / 3;
    vertices.push(0, rings[rings.length - 1].y, 0);
    const bottom = (rings.length - 1) * RADIAL_SEGMENTS;
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      indices.push(bottomCenter, bottom + segment, bottom + next);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  setSkinAttributes(geometry, rings, capTop, capBottom);
  return geometry;
}

/** Builds an outward-wound elliptical loft. Rings are ordered from top to bottom. */
export function createProfileGeometry(
  rings: ReadonlyArray<readonly [y: number, radiusX: number, radiusZ: number]>,
  boneIndex: number,
  capped: boolean | "top" = true,
): BufferGeometry {
  return createWeightedProfileGeometry(
    rings.map(([y, radiusX, radiusZ]) => ({
      y,
      radiusX,
      radiusZ,
      bones: [boneIndex, boneIndex],
      primaryWeight: 1,
    })),
    capped,
  );
}

function setRigidSkin(geometry: BufferGeometry, boneIndex: number): void {
  const count = geometry.getAttribute("position").count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    indices[index * 4] = boneIndex;
    weights[index * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(weights, 4));
}

function createSkinnedMesh(
  geometry: BufferGeometry,
  material: Material,
  skeleton: Skeleton,
  name: string,
): SkinnedMesh {
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = name;
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBone(name: string, x: number, y: number, z: number): Bone {
  const bone = new Bone();
  bone.name = name;
  bone.position.set(x, y, z);
  return bone;
}

function globalBindPosition(bone: Bone, target = new Vector3()): Vector3 {
  return bone.getWorldPosition(target);
}

export function createCharacterRig(proportions: BodyProportions, appearance: Appearance): CharacterRig {
  validateBodyProportions(proportions);
  validateAppearance(appearance);
  const root = new Group();
  root.name = "characterRig";

  const torso = makeBone("torso", 0, 0, 0);
  root.add(torso);
  const neck = makeBone("neck", 0, 0, 0);
  torso.add(neck);
  const headMount = new Group();
  headMount.name = "headMount";
  headMount.position.y = proportions.neckLength;
  neck.add(headMount);

  // SAFETY: Both entries are assigned in the exhaustive SIDES loop before arms is read.
  const arms = {} as CharacterRig["arms"];
  const fingerLengths = FINGER_LENGTHS.map((ratio) => ratio * proportions.handSize);
  for (const side of SIDES) {
    const sign = side === "left" ? -1 : 1;
    const upper = makeBone(`${side}UpperArm`, sign * proportions.shoulderWidth * 0.5, 0, 0);
    const forearm = makeBone(`${side}Forearm`, 0, -proportions.upperArmLength, 0);
    const hand = makeBone(`${side}Hand`, 0, -proportions.forearmLength, 0);
    torso.add(upper);
    upper.add(forearm);
    forearm.add(hand);
    const fingers: Bone[][] = [];
    for (let fingerIndex = 0; fingerIndex < FINGER_LENGTHS.length; fingerIndex += 1) {
      const totalLength = fingerLengths[fingerIndex];
      const chain: Bone[] = [];
      for (let joint = 0; joint < 3; joint += 1) {
        const x = joint === 0 ? FINGER_X[fingerIndex] * proportions.handSize : 0;
        const y = joint === 0 ? -proportions.handSize * (fingerIndex === 0 ? 0.18 : HAND_KNUCKLE_OFFSET_RATIO) : -totalLength / 3;
        const z = joint === 0 && fingerIndex === 0 ? -proportions.handSize * 0.08 : 0;
        const bone = makeBone(`${side}Finger${fingerIndex}.${joint}`, sign * x, y, z);
        (joint === 0 ? hand : chain[joint - 1]).add(bone);
        chain.push(bone);
      }
      fingers.push(chain);
    }
    arms[side] = { upper, forearm, hand, fingers };
  }
  root.updateMatrixWorld(true);

  const bones: Bone[] = [torso, neck];
  for (const side of SIDES) {
    const arm = arms[side];
    bones.push(arm.upper, arm.forearm, arm.hand, ...arm.fingers.flat());
  }
  const skeleton = new Skeleton(bones);
  const boneIndex = new Map(bones.map((bone, index) => [bone, index]));
  const shirtMaterial = new MeshStandardMaterial({ color: new Color(appearance.shirt), roughness: 0.82 });
  const skinMaterial = new MeshStandardMaterial({ color: new Color(appearance.skin), roughness: 0.72 });

  const torsoGeometry = createProfileGeometry(
    [
      [proportions.shoulderSlope, proportions.neckWidth * 0.62, proportions.chestDepth * 0.38],
      [0, proportions.shoulderWidth * 0.5, proportions.chestDepth * 0.48],
      [-proportions.torsoLength * 0.12, Math.max(proportions.shoulderWidth * 0.48, proportions.chestWidth * 0.5), proportions.chestDepth * 0.5],
      [-proportions.torsoLength * 0.24, proportions.chestWidth * 0.5, proportions.chestDepth * 0.5],
      [-proportions.torsoLength * 0.58, proportions.bellyWidth * 0.5, proportions.bellyDepth * 0.5],
      [-proportions.torsoLength, proportions.bellyWidth * 0.45, proportions.bellyDepth * 0.46],
    ],
    boneIndex.get(torso)!,
  );
  root.add(createSkinnedMesh(torsoGeometry, shirtMaterial, skeleton, "shirtTorso"));

  const neckGeometry = createProfileGeometry(
    [[0, proportions.neckWidth * 0.5, proportions.neckWidth * 0.47], [proportions.neckLength, proportions.neckWidth * 0.46, proportions.neckWidth * 0.44]],
    boneIndex.get(neck)!,
  );
  root.add(createSkinnedMesh(neckGeometry, skinMaterial, skeleton, "neck"));

  for (const side of SIDES) {
    const arm = arms[side];
    const shoulder = globalBindPosition(arm.upper);
    const upperIndex = boneIndex.get(arm.upper)!;
    const forearmIndex = boneIndex.get(arm.forearm)!;
    const handIndex = boneIndex.get(arm.hand)!;
    const elbowY = -proportions.upperArmLength;
    const wristY = elbowY - proportions.forearmLength;
    const armGeometry = createWeightedProfileGeometry([
      { y: 0, radiusX: proportions.upperArmRadius, radiusZ: proportions.upperArmRadius * 0.9, bones: [upperIndex, forearmIndex], primaryWeight: 1 },
      { y: elbowY * 0.82, radiusX: proportions.upperArmRadius * 0.84, radiusZ: proportions.upperArmRadius * 0.76, bones: [upperIndex, forearmIndex], primaryWeight: 1 },
      { y: elbowY * 0.94, radiusX: proportions.forearmRadius * 1.08, radiusZ: proportions.forearmRadius, bones: [upperIndex, forearmIndex], primaryWeight: 0.72 },
      { y: elbowY, radiusX: proportions.forearmRadius * 1.06, radiusZ: proportions.forearmRadius, bones: [upperIndex, forearmIndex], primaryWeight: 0.5 },
      { y: elbowY - proportions.forearmLength * 0.08, radiusX: proportions.forearmRadius * 1.04, radiusZ: proportions.forearmRadius * 0.96, bones: [upperIndex, forearmIndex], primaryWeight: 0.28 },
      { y: elbowY - proportions.forearmLength * 0.55, radiusX: proportions.forearmRadius * 0.88, radiusZ: proportions.forearmRadius * 0.82, bones: [forearmIndex, handIndex], primaryWeight: 1 },
      { y: wristY, radiusX: proportions.forearmRadius * 0.72, radiusZ: proportions.forearmRadius * 0.66, bones: [forearmIndex, handIndex], primaryWeight: 0 },
    ]);
    armGeometry.translate(shoulder.x, shoulder.y, shoulder.z);
    root.add(createSkinnedMesh(armGeometry, skinMaterial, skeleton, `${side}ArmSkin`));

    const sleeveLength = Math.min(proportions.upperArmLength * 0.42, proportions.upperArmLength - proportions.shirtClearance);
    const sleeveRadius = proportions.upperArmRadius + proportions.shirtClearance;
    const sleeveGeometry = createProfileGeometry(
      [[0.03, sleeveRadius * 1.12, sleeveRadius], [-sleeveLength, sleeveRadius, sleeveRadius * 0.92]],
      upperIndex,
      "top",
    );
    sleeveGeometry.translate(shoulder.x, shoulder.y, shoulder.z);
    root.add(createSkinnedMesh(sleeveGeometry, shirtMaterial, skeleton, `${side}OpenSleeve`));

    const wrist = globalBindPosition(arm.hand);
    const palmGeometry = new BoxGeometry(proportions.handSize * 0.72, proportions.handSize * 0.52, proportions.handSize * 0.3, 2, 3, 1);
    palmGeometry.translate(wrist.x, wrist.y - proportions.handSize * 0.25, wrist.z);
    setRigidSkin(palmGeometry, handIndex);
    root.add(createSkinnedMesh(palmGeometry, skinMaterial, skeleton, `${side}Palm`));

    for (let fingerIndex = 0; fingerIndex < arm.fingers.length; fingerIndex += 1) {
      const chain = arm.fingers[fingerIndex];
      const radius = proportions.handSize * (fingerIndex === 0 ? 0.095 : 0.075);
      const segmentLength = fingerLengths[fingerIndex] / 3;
      const rootPosition = globalBindPosition(chain[0]);
      const firstIndex = boneIndex.get(chain[0])!;
      const secondIndex = boneIndex.get(chain[1])!;
      const thirdIndex = boneIndex.get(chain[2])!;
      const fingerGeometry = createWeightedProfileGeometry([
        { y: 0, radiusX: radius, radiusZ: radius, bones: [firstIndex, secondIndex], primaryWeight: 1 },
        { y: -segmentLength * 0.86, radiusX: radius * 0.96, radiusZ: radius * 0.96, bones: [firstIndex, secondIndex], primaryWeight: 0.68 },
        { y: -segmentLength, radiusX: radius * 0.94, radiusZ: radius * 0.94, bones: [firstIndex, secondIndex], primaryWeight: 0.5 },
        { y: -segmentLength * 1.14, radiusX: radius * 0.91, radiusZ: radius * 0.91, bones: [firstIndex, secondIndex], primaryWeight: 0.25 },
        { y: -segmentLength * 1.86, radiusX: radius * 0.86, radiusZ: radius * 0.86, bones: [secondIndex, thirdIndex], primaryWeight: 0.68 },
        { y: -segmentLength * 2, radiusX: radius * 0.82, radiusZ: radius * 0.82, bones: [secondIndex, thirdIndex], primaryWeight: 0.5 },
        { y: -segmentLength * 2.14, radiusX: radius * 0.78, radiusZ: radius * 0.78, bones: [secondIndex, thirdIndex], primaryWeight: 0.25 },
        { y: -segmentLength * 2.9, radiusX: radius * 0.5, radiusZ: radius * 0.5, bones: [thirdIndex, thirdIndex], primaryWeight: 1 },
        { y: -segmentLength * 3, radiusX: radius * 0.08, radiusZ: radius * 0.08, bones: [thirdIndex, thirdIndex], primaryWeight: 1 },
      ]);
      fingerGeometry.translate(rootPosition.x, rootPosition.y, rootPosition.z);
      root.add(createSkinnedMesh(fingerGeometry, skinMaterial, skeleton, `${side}Finger${fingerIndex}`));
    }
  }

  let disposed = false;
  return {
    root,
    torso,
    neck,
    headMount,
    arms,
    proportions,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.traverse((object) => {
        if (object instanceof SkinnedMesh) object.geometry.dispose();
      });
      shirtMaterial.dispose();
      skinMaterial.dispose();
      skeleton.dispose();
      root.clear();
    },
  };
}
