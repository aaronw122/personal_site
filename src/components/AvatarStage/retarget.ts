import * as THREE from "three";

export const boneKey = (name: string) =>
  name.replace(/^mixamorig:?/, "").toLowerCase();

type Quat = THREE.QuaternionTuple;
export type RestPose = {
  bones: Record<string, { parent: string | null; local: Quat; world: Quat }>;
  hipsPosition: [number, number, number];
  hipsParent: number[];
  hipsHeight: number;
};

export function normalizeAvatar(root: THREE.Object3D, id: string) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  if (height <= 0) throw new Error(`Avatar ${id} has no visible height`);
  root.scale.multiplyScalar(1 / height);
  root.position.y -= bounds.min.y / height;
  root.updateWorldMatrix(true, true);
  const skeleton: THREE.Bone[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Bone) skeleton.push(node);
  });
  const find = (key: string) =>
    skeleton.find((bone) => boneKey(bone.name) === key);
  const leftFoot = find("leftfoot"),
    rightFoot = find("rightfoot"),
    leftToe = find("lefttoebase"),
    rightToe = find("righttoebase");
  if (!leftFoot || !rightFoot || !leftToe || !rightToe)
    throw new Error(`Avatar ${id} is missing Mixamo foot and toe bones`);
  const toes = leftToe
    .getWorldPosition(new THREE.Vector3())
    .add(rightToe.getWorldPosition(new THREE.Vector3()))
    .multiplyScalar(0.5);
  const feet = leftFoot
    .getWorldPosition(new THREE.Vector3())
    .add(rightFoot.getWorldPosition(new THREE.Vector3()))
    .multiplyScalar(0.5);
  const forward = toes.sub(feet).setY(0).normalize();
  if (forward.lengthSq() < 0.01)
    throw new Error(`Avatar ${id} has undefined skeleton facing`);
  root.rotation.y = -Math.atan2(forward.x, forward.z);
  root.updateWorldMatrix(true, true);
  return { skeleton, leftFoot, rightFoot, leftToe, rightToe };
}

export function restPose(skeleton: THREE.Bone[]): RestPose {
  const hips = skeleton.find((bone) => boneKey(bone.name) === "hips");
  if (!hips?.parent) throw new Error("Skeleton has no Mixamo hips");
  const bones: RestPose["bones"] = {};
  const world = new THREE.Quaternion();
  for (const bone of skeleton) {
    bone.getWorldQuaternion(world);
    bones[boneKey(bone.name)] = {
      parent:
        bone.parent instanceof THREE.Bone ? boneKey(bone.parent.name) : null,
      local: bone.quaternion.toArray([0, 0, 0, 0]),
      world: world.toArray([0, 0, 0, 0]),
    };
  }
  return {
    bones,
    hipsPosition: hips.position.toArray(),
    hipsParent: hips.parent.matrixWorld.toArray(),
    hipsHeight: hips.getWorldPosition(new THREE.Vector3()).y,
  };
}

const FPS = 30;

export function retargetClip(
  clip: THREE.AnimationClip,
  source: RestPose,
  skeleton: THREE.Bone[],
): THREE.AnimationClip {
  const target = restPose(skeleton);
  const sampled = new Map<string, THREE.Interpolant>();
  let hipsTrack: THREE.Interpolant | null = null;
  for (const track of clip.tracks) {
    const separator = track.name.lastIndexOf(".");
    const key = boneKey(track.name.slice(0, separator));
    const property = track.name.slice(separator + 1);
    if (property === "quaternion")
      sampled.set(
        key,
        new THREE.QuaternionLinearInterpolant(
          track.times,
          track.values,
          4,
          new Float32Array(4),
        ),
      );
    else if (property === "position" && key === "hips")
      hipsTrack = new THREE.LinearInterpolant(
        track.times,
        track.values,
        3,
        new Float32Array(3),
      );
  }
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = Float32Array.from({ length: frames }, (_, index) =>
    Math.min(clip.duration, index / FPS),
  );
  const values = skeleton.map(() => new Float32Array(frames * 4));
  const hipsValues = new Float32Array(frames * 3);
  const sourceWorld = new Map<string, THREE.Quaternion>();
  const targetWorld = new Map<string, THREE.Quaternion>();
  const sourceKeys = Object.keys(source.bones);
  const sourceRestInverse = new Map(
    sourceKeys.map((key) => [
      key,
      new THREE.Quaternion().fromArray(source.bones[key].world).invert(),
    ]),
  );
  const rootParent = (rest: RestPose["bones"][string]) =>
    new THREE.Quaternion()
      .fromArray(rest.world)
      .multiply(new THREE.Quaternion().fromArray(rest.local).invert());
  const delta = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const sourceHipsParent = new THREE.Matrix3().setFromMatrix4(
    new THREE.Matrix4().fromArray(source.hipsParent),
  );
  const targetHipsParentInverse = new THREE.Matrix3()
    .setFromMatrix4(new THREE.Matrix4().fromArray(target.hipsParent))
    .invert();
  const sourceHipsRest = new THREE.Vector3().fromArray(source.hipsPosition);
  const legScale = target.hipsHeight / source.hipsHeight;
  const offset = new THREE.Vector3();
  for (let frame = 0; frame < frames; frame++) {
    for (const key of sourceKeys) {
      const rest = source.bones[key];
      const parent = rest.parent ? sourceWorld.get(rest.parent) : undefined;
      const animated = sampled.get(key)?.evaluate(times[frame]);
      local.fromArray(animated ?? rest.local).normalize();
      sourceWorld.set(
        key,
        (parent ? parent.clone() : rootParent(rest)).multiply(local),
      );
    }
    skeleton.forEach((bone, index) => {
      const key = boneKey(bone.name);
      const rest = target.bones[key];
      const parentWorld = rest.parent
        ? targetWorld.get(rest.parent)
        : undefined;
      const parent = parentWorld ? parentWorld.clone() : rootParent(rest);
      const world = sourceWorld.get(key);
      const restInverse = sourceRestInverse.get(key);
      if (world && restInverse) {
        delta.copy(world).multiply(restInverse);
        const next = delta
          .multiply(new THREE.Quaternion().fromArray(rest.world))
          .clone();
        targetWorld.set(key, next);
        local.copy(parent).invert().multiply(next);
      } else {
        local.fromArray(rest.local);
        targetWorld.set(key, parent.multiply(local));
      }
      local.toArray(values[index], frame * 4);
    });
    const hips = hipsTrack?.evaluate(times[frame]);
    offset.set(0, 0, 0);
    if (hips)
      offset
        .fromArray(hips)
        .sub(sourceHipsRest)
        .applyMatrix3(sourceHipsParent)
        .multiplyScalar(legScale)
        .applyMatrix3(targetHipsParentInverse);
    offset
      .add(new THREE.Vector3().fromArray(target.hipsPosition))
      .toArray(hipsValues, frame * 3);
  }
  const tracks: THREE.KeyframeTrack[] = skeleton.map(
    (bone, index) =>
      new THREE.QuaternionKeyframeTrack(
        `${bone.name}.quaternion`,
        times,
        values[index],
      ),
  );
  const hipsBone = skeleton.find((bone) => boneKey(bone.name) === "hips");
  if (hipsBone)
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${hipsBone.name}.position`,
        times,
        hipsValues,
      ),
    );
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
