import { describe, expect, test } from "bun:test";
import { Bone, Group, Quaternion, Vector3 } from "three";
import { applyPeekPose, createPoseScratch } from "../../src/components/CharacterRig/pose.ts";
import type {
  Appearance,
  ArmRig,
  BodyShape,
  CharacterRig,
  PeekPose,
  Side,
} from "../../src/components/CharacterRig/types.ts";

const appearance: Appearance = { skin: "#d6a17d", shirt: "#234567" };
const shape: BodyShape = {
  chestWidth: 1,
  chestDepth: 0.45,
  bellyWidth: 1,
  bellyDepth: 0.5,
  torsoLength: 1.4,
  shoulderWidth: 1.2,
  shoulderSlope: 0,
  neckWidth: 0.25,
  neckLength: 0.3,
  upperArmLength: 0.8,
  forearmLength: 0.5,
  upperArmRadius: 0.14,
  forearmRadius: 0.11,
  handSize: 0.3,
  shirtClearance: 0.02,
};
void appearance;

function makeArm(side: Side, torso: Bone): ArmRig {
  const upper = new Bone();
  const forearm = new Bone();
  const hand = new Bone();
  upper.position.set(side === "left" ? -shape.shoulderWidth / 2 : shape.shoulderWidth / 2, 0, 0);
  forearm.position.set(0, -shape.upperArmLength, 0);
  hand.position.set(0, -shape.forearmLength, 0);
  torso.add(upper);
  upper.add(forearm);
  forearm.add(hand);

  const fingers = Array.from({ length: 5 }, (_, fingerIndex) => {
    const chain: Bone[] = [];
    let parent = hand;
    for (let jointIndex = 0; jointIndex < 3; jointIndex += 1) {
      const joint = new Bone();
      joint.position.set(fingerIndex * 0.01, jointIndex === 0 ? -0.12 : -0.07, 0);
      parent.add(joint);
      parent = joint;
      chain.push(joint);
    }
    return chain;
  });
  return { upper, forearm, hand, fingers };
}

function makeRig(): CharacterRig {
  const root = new Group();
  const torso = new Bone();
  const neck = new Bone();
  const headMount = new Group();
  root.add(torso);
  torso.add(neck);
  neck.add(headMount);
  headMount.position.set(0, shape.neckLength, 0);
  return {
    root,
    torso,
    neck,
    headMount,
    arms: {
      left: makeArm("left", torso),
      right: makeArm("right", torso),
    },
    shape,
    dispose() {},
  };
}

function makePose(left: [number, number, number], right: [number, number, number]): PeekPose {
  return {
    torsoPosition: [0, 0, 0],
    torsoRoll: 0,
    headRoll: 0,
    headYaw: 0,
    yawRange: 0,
    cycleSeconds: 4,
    edgeX: 0,
    left: { position: left, elbowDirection: [0, 0, 1] },
    right: { position: right, elbowDirection: [0, 0, 1] },
  };
}

function expectVectorClose(actual: Vector3, expected: Vector3, precision = 7): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function handWorldPosition(rig: CharacterRig, side: Side): Vector3 {
  return rig.arms[side].hand.getWorldPosition(new Vector3());
}

describe("applyPeekPose", () => {
  test("places reachable wrists on root-local targets through world transforms", () => {
    const rig = makeRig();
    rig.root.position.set(3, -2, 4);
    rig.root.rotation.set(0.22, -0.47, 0.31);
    const pose = makePose([-0.2, -0.8, 0.25], [0.25, -0.72, 0.3]);

    rig.root.scale.setScalar(1.7);
    const status = applyPeekPose(rig, pose, 0, createPoseScratch());
    rig.root.updateWorldMatrix(true, true);

    expect(status.left.reachable).toBe(true);
    expect(status.right.reachable).toBe(true);
    expectVectorClose(handWorldPosition(rig, "left"), new Vector3(...pose.left.position).applyMatrix4(rig.root.matrixWorld));
    expectVectorClose(handWorldPosition(rig, "right"), new Vector3(...pose.right.position).applyMatrix4(rig.root.matrixWorld));
  });

  test("reports and clamps targets outside both reach boundaries without stretching", () => {
    const rig = makeRig();
    const shoulderX = -shape.shoulderWidth / 2;
    const pose = makePose([shoulderX, -2, 0], [shape.shoulderWidth / 2, -0.1, 0]);

    const status = applyPeekPose(rig, pose, 0, createPoseScratch());
    rig.root.updateWorldMatrix(true, true);

    expect(status.left).toEqual({ reachable: false, distance: 2, minimum: 0.30000000000000004, maximum: 1.3 });
    expect(status.right.reachable).toBe(false);
    expect(handWorldPosition(rig, "left").distanceTo(new Vector3(shoulderX, 0, 0))).toBeCloseTo(1.3, 8);
    expect(handWorldPosition(rig, "right").distanceTo(new Vector3(-shoulderX, 0, 0))).toBeCloseTo(0.3, 8);

    pose.left.position[1] = -1.3;
    pose.right.position[1] = -0.3;
    const boundaryStatus = applyPeekPose(rig, pose, 0, createPoseScratch());
    expect(boundaryStatus.left.reachable).toBe(true);
    expect(boundaryStatus.right.reachable).toBe(true);
  });

  test("uses a deterministic fallback for zero and parallel elbow poles", () => {
    const rig = makeRig();
    const pose = makePose([-0.6, -0.7, 0], [0.6, -0.7, 0]);
    pose.left.elbowDirection = [0, 0, 0];
    pose.right.elbowDirection = [0, -1, 0];

    applyPeekPose(rig, pose, 0, createPoseScratch());
    rig.root.updateWorldMatrix(true, true);

    for (const side of ["left", "right"] as const) {
      const elbow = rig.arms[side].forearm.getWorldPosition(new Vector3());
      expect(Number.isFinite(elbow.x + elbow.y + elbow.z)).toBe(true);
      expect(Math.abs(elbow.z)).toBeGreaterThan(0.1);
      expectVectorClose(handWorldPosition(rig, side), new Vector3(...pose[side].position));
    }
  });

  test("head yaw and roll vary independently while grips and torso stay fixed", () => {
    const rig = makeRig();
    const pose = makePose([-0.25, -0.78, 0.2], [0.3, -0.7, 0.24]);
    pose.torsoPosition = [-0.15, 0.08, 0.03];
    pose.torsoRoll = 0.16;
    pose.headYaw = -0.12;
    pose.headRoll = 0.09;
    pose.yawRange = 0.42;
    rig.headMount.rotation.set(0.3, 0.2, 0.1);
    const headMountRotation = rig.headMount.quaternion.clone();
    const scratch = createPoseScratch();

    const firstStatus = applyPeekPose(rig, pose, -1, scratch);
    const leftGrip = handWorldPosition(rig, "left");
    const rightGrip = handWorldPosition(rig, "right");
    const torsoRotation = rig.torso.quaternion.clone();
    const expectedNeck = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), pose.headYaw - pose.yawRange)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), pose.headRoll));
    expect(Math.abs(rig.neck.quaternion.dot(expectedNeck))).toBeCloseTo(1, 8);
    expect(Math.abs(rig.headMount.quaternion.dot(headMountRotation))).toBeCloseTo(1, 8);

    const secondStatus = applyPeekPose(rig, pose, 1, scratch);
    rig.root.updateWorldMatrix(true, true);
    expect(secondStatus).toBe(firstStatus);
    expectVectorClose(handWorldPosition(rig, "left"), leftGrip);
    expectVectorClose(handWorldPosition(rig, "right"), rightGrip);
    expect(Math.abs(rig.torso.quaternion.dot(torsoRotation))).toBeCloseTo(1, 8);
    expect(rig.neck.quaternion.equals(expectedNeck)).toBe(false);
  });

  test("curls finger bind axes toward edge-right while retaining dorsal +Z", () => {
    const rig = makeRig();
    const pose = makePose([-0.2, -0.8, 0.2], [0.2, -0.8, 0.2]);
    applyPeekPose(rig, pose, 0, createPoseScratch());

    const finger = rig.arms.right.fingers[1][0];
    const down = new Vector3(0, -1, 0).applyQuaternion(finger.quaternion);
    const dorsal = new Vector3(0, 0, 1).applyQuaternion(finger.quaternion);
    expect(down.x).toBeGreaterThan(0);
    expect(down.y).toBeLessThan(0);
    expectVectorClose(dorsal, new Vector3(0, 0, 1));
  });
});
