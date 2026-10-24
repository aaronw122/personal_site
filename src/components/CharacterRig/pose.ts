import { Quaternion, Vector3 } from "three";
import { HAND_KNUCKLE_OFFSET_RATIO } from "./body";
import type { ArmRig, CharacterRig, PeekPose, PoseScratch, PoseStatus, ReachStatus, Side } from "./types";

const DOWN_X = 0;
const DOWN_Y = -1;
const DOWN_Z = 0;
const EPSILON = 1e-8;
const REACH_EPSILON = 1e-7;
const SIDES: Side[] = ["left", "right"];
const NON_THUMB_CURL = [0.35, 0.45, 0.35] as const;

export function createPoseScratch(): PoseScratch {
  return {
    shoulder: new Vector3(),
    target: new Vector3(),
    pole: new Vector3(),
    elbow: new Vector3(),
    wrist: new Vector3(),
    direction: new Vector3(),
    perpendicular: new Vector3(),
    localDirection: new Vector3(),
    parentRotation: new Quaternion(),
    rotation: new Quaternion(),
    status: {
      left: { reachable: true, distance: 0, minimum: 0, maximum: 0 },
      right: { reachable: true, distance: 0, minimum: 0, maximum: 0 },
    },
  };
}

/** Applies a root-local peek pose without rebuilding geometry or allocating frame objects. */
export function applyPeekPose(
  rig: CharacterRig,
  pose: PeekPose,
  turn: number,
  scratch: PoseScratch,
): PoseStatus {
  rig.torso.position.set(pose.torsoPosition[0], pose.torsoPosition[1], pose.torsoPosition[2]);
  rig.torso.quaternion.setFromAxisAngle(scratch.direction.set(0, 0, 1), pose.torsoRoll);

  const yaw = pose.headYaw + pose.yawRange * clamp(turn, -1, 1);
  setYawRoll(rig.neck.quaternion, yaw, pose.headRoll);

  rig.root.updateWorldMatrix(true, true);
  for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex += 1) {
    const side = SIDES[sideIndex];
    const grip = pose[side];
    // Grip X is an offset from the edge plane; Y/Z are root-local contact coordinates.
    solveArm(
      rig,
      rig.arms[side],
      pose.edgeX + grip.position[0] - HAND_KNUCKLE_OFFSET_RATIO * rig.shape.handSize,
      grip.position[1],
      grip.position[2],
      grip.elbowDirection,
      scratch.status[side],
      scratch,
    );
  }
  return scratch.status;
}

function solveArm(
  rig: CharacterRig,
  arm: ArmRig,
  targetX: number,
  targetY: number,
  targetZ: number,
  pole: readonly [number, number, number],
  status: ReachStatus,
  scratch: PoseScratch,
): void {
  arm.upper.getWorldPosition(scratch.shoulder);
  rig.root.worldToLocal(scratch.shoulder);
  scratch.target.set(targetX, targetY, targetZ);

  scratch.direction.subVectors(scratch.target, scratch.shoulder);
  const distance = scratch.direction.length();
  const minimum = Math.abs(rig.shape.upperArmLength - rig.shape.forearmLength);
  const maximum = rig.shape.upperArmLength + rig.shape.forearmLength;
  const clampedDistance = clamp(distance, minimum, maximum);
  status.distance = distance;
  status.minimum = minimum;
  status.maximum = maximum;
  status.reachable = distance >= minimum - REACH_EPSILON && distance <= maximum + REACH_EPSILON;

  if (distance > EPSILON) {
    scratch.direction.multiplyScalar(1 / distance);
  } else {
    // The bind direction is deterministic when target and shoulder coincide.
    scratch.direction.set(DOWN_X, DOWN_Y, DOWN_Z);
  }

  // elbowDirection is a root-local direction, not a position.
  scratch.pole.set(pole[0], pole[1], pole[2]);
  scratch.perpendicular.copy(scratch.pole).addScaledVector(
    scratch.direction,
    -scratch.pole.dot(scratch.direction),
  );
  if (scratch.perpendicular.lengthSq() <= EPSILON) {
    choosePerpendicular(scratch.direction, scratch.perpendicular);
  } else {
    scratch.perpendicular.normalize();
  }

  const upperLength = rig.shape.upperArmLength;
  const forearmLength = rig.shape.forearmLength;
  const safeDistance = Math.max(clampedDistance, EPSILON);
  const along = (safeDistance * safeDistance + upperLength * upperLength - forearmLength * forearmLength)
    / (2 * safeDistance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));

  scratch.elbow.copy(scratch.shoulder)
    .addScaledVector(scratch.direction, along)
    .addScaledVector(scratch.perpendicular, height);
  scratch.wrist.copy(scratch.shoulder).addScaledVector(scratch.direction, clampedDistance);

  scratch.elbow.applyMatrix4(rig.root.matrixWorld);
  scratch.wrist.applyMatrix4(rig.root.matrixWorld);
  aimBoneAtWorldPoint(arm.upper, scratch.elbow, scratch);
  arm.upper.updateWorldMatrix(false, true);
  aimBoneAtWorldPoint(arm.forearm, scratch.wrist, scratch);
  arm.forearm.updateWorldMatrix(false, true);

  // Fingers point edge-right (+X), with the back of the hand facing the viewer (+Z).
  rig.root.getWorldQuaternion(scratch.rotation);
  const rootX = scratch.rotation.x;
  const rootY = scratch.rotation.y;
  const rootZ = scratch.rotation.z;
  const rootW = scratch.rotation.w;
  scratch.rotation.set(
    Math.SQRT1_2 * (rootX + rootY),
    Math.SQRT1_2 * (rootY - rootX),
    Math.SQRT1_2 * (rootZ + rootW),
    Math.SQRT1_2 * (rootW - rootZ),
  );
  arm.forearm.getWorldQuaternion(scratch.parentRotation).invert();
  arm.hand.quaternion.copy(scratch.parentRotation).multiply(scratch.rotation).normalize();
  curlFingers(arm);
  arm.hand.updateWorldMatrix(false, true);
}

function aimBoneAtWorldPoint(
  bone: ArmRig["upper"],
  point: Vector3,
  scratch: PoseScratch,
): void {
  bone.getWorldPosition(scratch.localDirection);
  scratch.localDirection.subVectors(point, scratch.localDirection).normalize();
  bone.parent!.getWorldQuaternion(scratch.parentRotation).invert();
  scratch.localDirection.applyQuaternion(scratch.parentRotation);
  bone.quaternion.setFromUnitVectors(
    scratch.perpendicular.set(DOWN_X, DOWN_Y, DOWN_Z),
    scratch.localDirection,
  );
}

function choosePerpendicular(direction: Vector3, out: Vector3): void {
  // Prefer viewer-forward elbow bend; switch axes only when parallel to avoid an unstable pole.
  if (Math.abs(direction.z) < 0.9) {
    out.set(0, 0, 1);
  } else {
    out.set(1, 0, 0);
  }
  out.addScaledVector(direction, -out.dot(direction)).normalize();
}

function curlFingers(arm: ArmRig): void {
  for (let fingerIndex = 0; fingerIndex < arm.fingers.length; fingerIndex += 1) {
    const chain = arm.fingers[fingerIndex];
    const isThumb = fingerIndex === 0;
    for (let jointIndex = 0; jointIndex < chain.length; jointIndex += 1) {
      const angle = isThumb ? 0.48 + jointIndex * 0.16 : NON_THUMB_CURL[jointIndex];
      chain[jointIndex].quaternion.set(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2));
    }
  }
}

function setYawRoll(out: Quaternion, yaw: number, roll: number): void {
  const halfYaw = yaw / 2;
  const halfRoll = roll / 2;
  const sy = Math.sin(halfYaw);
  const cy = Math.cos(halfYaw);
  const sz = Math.sin(halfRoll);
  const cz = Math.cos(halfRoll);
  // Yaw around +Y followed by roll around +Z.
  out.set(sy * sz, sy * cz, cy * sz, cy * cz);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
