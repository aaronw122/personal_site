import type { Bone, Group, Object3D, Quaternion, Vector3 } from "three";

/** Right-handed frame: +X right, +Y up, +Z toward viewer. One unit is head height. */
export type Vec3 = [number, number, number];
export type Side = "left" | "right";
export type BodyShape = {
  chestWidth: number;
  chestDepth: number;
  bellyWidth: number;
  bellyDepth: number;
  torsoLength: number;
  shoulderWidth: number;
  shoulderSlope: number;
  neckWidth: number;
  neckLength: number;
  upperArmLength: number;
  forearmLength: number;
  upperArmRadius: number;
  forearmRadius: number;
  handSize: number;
  shirtClearance: number;
};
export type Appearance = { skin: string; shirt: string };
export type HeadAttachment = {
  source: string;
  node?: string;
  scale: number;
  rotation: Vec3;
  neckPivot: Vec3;
};
/** Contact x is an offset from edgeX; y/z are root-local. This is not the wrist. */
export type GripTarget = { position: Vec3; elbowDirection: Vec3 };
export type PeekPose = {
  torsoPosition: Vec3;
  torsoRoll: number;
  headRoll: number;
  headYaw: number;
  yawRange: number;
  cycleSeconds: number;
  edgeX: number;
  left: GripTarget;
  right: GripTarget;
};
export type CharacterConfig = {
  id: string;
  label: string;
  shape: BodyShape;
  appearance: Appearance;
  head: HeadAttachment | null;
  pose: PeekPose;
};

/** Arm bind axes point down (-Y); hand finger axes continue down (-Y), dorsal +Z. */
export type ArmRig = {
  upper: Bone;
  forearm: Bone;
  hand: Bone;
  fingers: Bone[][];
};
export type CharacterRig = {
  root: Group;
  torso: Bone;
  neck: Bone;
  headMount: Group;
  arms: Record<Side, ArmRig>;
  shape: BodyShape;
  dispose(): void;
};
export type ReachStatus = { reachable: boolean; distance: number; minimum: number; maximum: number };
export type PoseStatus = Record<Side, ReachStatus>;
export type ArmSolution = { elbow: Vector3; wrist: Vector3; status: ReachStatus };
export type PoseScratch = {
  status: PoseStatus;
  shoulder: Vector3;
  target: Vector3;
  pole: Vector3;
  elbow: Vector3;
  wrist: Vector3;
  direction: Vector3;
  perpendicular: Vector3;
  localDirection: Vector3;
  parentRotation: Quaternion;
  rotation: Quaternion;
};
export type HeadInstance = { object: Object3D; dispose(): void };
