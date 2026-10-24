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
  SphereGeometry,
  Vector3,
} from "three";
import type { Material } from "three";
import type { Appearance, BodyShape, CharacterRig } from "./types";

const SIDES = ["left", "right"] as const;
const RADIAL_SEGMENTS = 12;
const FINGER_LENGTHS = [0.58, 0.82, 0.9, 0.82, 0.68] as const;
const FINGER_X = [-0.48, -0.31, -0.1, 0.13, 0.35] as const;
const SHAPE_FIELDS: ReadonlyArray<keyof BodyShape> = [
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

function assertFinitePositive(name: keyof BodyShape, value: number): void {
  const permitsZero = name === "shoulderSlope";
  if (!Number.isFinite(value) || (permitsZero ? value < 0 : value <= 0)) {
    const range = permitsZero ? "zero or greater" : "greater than zero";
    throw new RangeError(`shape.${name} must be a finite number ${range}`);
  }
}

export function validateBodyShape(shape: BodyShape): void {
  for (const name of SHAPE_FIELDS) {
    assertFinitePositive(name, shape[name]);
  }
  if (shape.neckWidth >= shape.shoulderWidth) {
    throw new RangeError("shape.neckWidth must be less than shape.shoulderWidth");
  }
}

function validateAppearance(appearance: Appearance): void {
  if (typeof appearance.skin !== "string" || appearance.skin.trim().length === 0) {
    throw new TypeError("appearance.skin must be a non-empty color string");
  }
  if (typeof appearance.shirt !== "string" || appearance.shirt.trim().length === 0) {
    throw new TypeError("appearance.shirt must be a non-empty color string");
  }
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

/** Builds a smooth elliptical loft. Rings are ordered from top to bottom. */
export function createProfileGeometry(
  rings: ReadonlyArray<readonly [y: number, radiusX: number, radiusZ: number]>,
  boneIndex: number,
  capped = true,
): BufferGeometry {
  if (rings.length < 2) throw new RangeError("A profile requires at least two rings");
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [y, radiusX, radiusZ] of rings) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const angle = (segment / RADIAL_SEGMENTS) * Math.PI * 2;
      vertices.push(Math.cos(angle) * radiusX, y, Math.sin(angle) * radiusZ);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      const top = ring * RADIAL_SEGMENTS;
      const bottom = (ring + 1) * RADIAL_SEGMENTS;
      indices.push(top + segment, bottom + segment, top + next);
      indices.push(top + next, bottom + segment, bottom + next);
    }
  }
  if (capped) {
    const topCenter = vertices.length / 3;
    vertices.push(0, rings[0][0], 0);
    const bottomCenter = vertices.length / 3;
    vertices.push(0, rings[rings.length - 1][0], 0);
    const bottom = (rings.length - 1) * RADIAL_SEGMENTS;
    for (let segment = 0; segment < RADIAL_SEGMENTS; segment += 1) {
      const next = (segment + 1) % RADIAL_SEGMENTS;
      indices.push(topCenter, segment, next);
      indices.push(bottomCenter, bottom + next, bottom + segment);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  setRigidSkin(geometry, boneIndex);
  return geometry;
}

function createLimbGeometry(length: number, topRadius: number, bottomRadius: number, boneIndex: number): BufferGeometry {
  return createProfileGeometry(
    [
      [0, topRadius, topRadius * 0.9],
      [-length * 0.48, (topRadius + bottomRadius) * 0.52, (topRadius + bottomRadius) * 0.47],
      [-length, bottomRadius, bottomRadius * 0.9],
    ],
    boneIndex,
  );
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

export function createCharacterRig(shape: BodyShape, appearance: Appearance): CharacterRig {
  validateBodyShape(shape);
  validateAppearance(appearance);
  const root = new Group();
  root.name = "characterRig";

  const torso = makeBone("torso", 0, 0, 0);
  root.add(torso);
  const neck = makeBone("neck", 0, 0, 0);
  torso.add(neck);
  const headMount = new Group();
  headMount.name = "headMount";
  headMount.position.y = shape.neckLength;
  neck.add(headMount);

  const arms = {} as CharacterRig["arms"];
  const fingerLengths = FINGER_LENGTHS.map((ratio) => ratio * shape.handSize);
  for (const side of SIDES) {
    const sign = side === "left" ? -1 : 1;
    const upper = makeBone(`${side}UpperArm`, sign * shape.shoulderWidth * 0.5, 0, 0);
    const forearm = makeBone(`${side}Forearm`, 0, -shape.upperArmLength, 0);
    const hand = makeBone(`${side}Hand`, 0, -shape.forearmLength, 0);
    torso.add(upper);
    upper.add(forearm);
    forearm.add(hand);
    const fingers: Bone[][] = [];
    for (let fingerIndex = 0; fingerIndex < FINGER_LENGTHS.length; fingerIndex += 1) {
      const totalLength = fingerLengths[fingerIndex];
      const chain: Bone[] = [];
      for (let joint = 0; joint < 3; joint += 1) {
        const x = joint === 0 ? FINGER_X[fingerIndex] * shape.handSize : 0;
        const y = joint === 0 ? -shape.handSize * (fingerIndex === 0 ? 0.22 : 0.66) : -totalLength / 3;
        const z = joint === 0 && fingerIndex === 0 ? -shape.handSize * 0.08 : 0;
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
      [shape.shoulderSlope, shape.neckWidth * 0.62, shape.chestDepth * 0.38],
      [0, shape.chestWidth * 0.5, shape.chestDepth * 0.48],
      [-shape.torsoLength * 0.2, shape.chestWidth * 0.5, shape.chestDepth * 0.5],
      [-shape.torsoLength * 0.58, shape.bellyWidth * 0.5, shape.bellyDepth * 0.5],
      [-shape.torsoLength, shape.bellyWidth * 0.45, shape.bellyDepth * 0.46],
    ],
    boneIndex.get(torso)!,
  );
  root.add(createSkinnedMesh(torsoGeometry, shirtMaterial, skeleton, "shirtTorso"));

  const neckGeometry = createProfileGeometry(
    [[0, shape.neckWidth * 0.5, shape.neckWidth * 0.47], [shape.neckLength, shape.neckWidth * 0.46, shape.neckWidth * 0.44]],
    boneIndex.get(neck)!,
  );
  root.add(createSkinnedMesh(neckGeometry, skinMaterial, skeleton, "neck"));

  for (const side of SIDES) {
    const arm = arms[side];
    const shoulder = globalBindPosition(arm.upper);
    const upperGeometry = createLimbGeometry(
      shape.upperArmLength,
      shape.upperArmRadius,
      shape.upperArmRadius * 0.82,
      boneIndex.get(arm.upper)!,
    );
    upperGeometry.translate(shoulder.x, shoulder.y, shoulder.z);
    root.add(createSkinnedMesh(upperGeometry, skinMaterial, skeleton, `${side}UpperArmSkin`));

    const sleeveLength = Math.min(shape.upperArmLength * 0.42, shape.upperArmLength - shape.shirtClearance);
    const sleeveRadius = shape.upperArmRadius + shape.shirtClearance;
    const sleeveGeometry = createProfileGeometry(
      [[0.03, sleeveRadius * 1.12, sleeveRadius], [-sleeveLength, sleeveRadius, sleeveRadius * 0.92]],
      boneIndex.get(arm.upper)!,
      false,
    );
    sleeveGeometry.translate(shoulder.x, shoulder.y, shoulder.z);
    root.add(createSkinnedMesh(sleeveGeometry, shirtMaterial, skeleton, `${side}OpenSleeve`));

    const elbow = globalBindPosition(arm.forearm);
    const forearmGeometry = createLimbGeometry(
      shape.forearmLength,
      shape.forearmRadius * 1.04,
      shape.forearmRadius * 0.72,
      boneIndex.get(arm.forearm)!,
    );
    forearmGeometry.translate(elbow.x, elbow.y, elbow.z);
    root.add(createSkinnedMesh(forearmGeometry, skinMaterial, skeleton, `${side}ForearmSkin`));

    const wrist = globalBindPosition(arm.hand);
    const palmGeometry = new BoxGeometry(shape.handSize * 0.78, shape.handSize, shape.handSize * 0.34, 2, 3, 1);
    palmGeometry.translate(wrist.x, wrist.y - shape.handSize * 0.48, wrist.z);
    setRigidSkin(palmGeometry, boneIndex.get(arm.hand)!);
    root.add(createSkinnedMesh(palmGeometry, skinMaterial, skeleton, `${side}Palm`));

    for (let fingerIndex = 0; fingerIndex < arm.fingers.length; fingerIndex += 1) {
      const chain = arm.fingers[fingerIndex];
      const radius = shape.handSize * (fingerIndex === 0 ? 0.115 : 0.09);
      const segmentLength = fingerLengths[fingerIndex] / 3;
      for (let joint = 0; joint < chain.length; joint += 1) {
        const fingerBone = chain[joint];
        const origin = globalBindPosition(fingerBone);
        const geometry = createLimbGeometry(segmentLength, radius, radius * 0.84, boneIndex.get(fingerBone)!);
        geometry.translate(origin.x, origin.y, origin.z);
        root.add(createSkinnedMesh(geometry, skinMaterial, skeleton, `${side}Finger${fingerIndex}.${joint}`));
      }
      const tip = globalBindPosition(chain[2]);
      const tipGeometry = new SphereGeometry(radius * 0.85, 8, 6);
      tipGeometry.scale(1, 1.3, 1);
      tipGeometry.translate(tip.x, tip.y - segmentLength, tip.z);
      setRigidSkin(tipGeometry, boneIndex.get(chain[2])!);
      root.add(createSkinnedMesh(tipGeometry, skinMaterial, skeleton, `${side}Finger${fingerIndex}Tip`));
    }
  }

  let disposed = false;
  return {
    root,
    torso,
    neck,
    headMount,
    arms,
    shape,
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
