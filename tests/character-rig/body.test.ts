import { describe, expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, Object3D, SkinnedMesh, Vector3 } from "three";
import {
  createCharacterRig,
  createProfileGeometry,
  HAND_KNUCKLE_OFFSET_RATIO,
  validateBodyProportions,
} from "../../src/components/CharacterRig/body";
import { CHARACTER_PRESETS } from "../../src/components/CharacterRig/presets";

const lean = CHARACTER_PRESETS.find((preset) => preset.id === "lean");
if (!lean) throw new Error("Lean character preset is required for body tests");

function requireSkinnedMesh(root: Object3D, name: string): SkinnedMesh {
  const object = root.getObjectByName(name);
  if (!(object instanceof SkinnedMesh)) throw new Error(`Expected ${name} to be a SkinnedMesh`);
  return object;
}

function requireBufferAttribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const attribute = geometry.getAttribute(name);
  if (!(attribute instanceof BufferAttribute)) throw new Error(`Expected ${name} to be a BufferAttribute`);
  return attribute;
}

describe("character body", () => {
  test("builds the documented bind hierarchy and articulated hands", () => {
    const rig = createCharacterRig(lean.proportions, lean.appearance);

    expect(rig.torso.parent).toBe(rig.root);
    expect(rig.neck.parent).toBe(rig.torso);
    expect(rig.headMount.parent).toBe(rig.neck);
    expect(rig.headMount.position.y).toBe(lean.proportions.neckLength);
    for (const [side, arm] of Object.entries(rig.arms)) {
      expect(arm.upper.parent).toBe(rig.torso);
      expect(arm.upper.position.x).toBe((side === "left" ? -1 : 1) * lean.proportions.shoulderWidth / 2);
      expect(arm.forearm.parent).toBe(arm.upper);
      expect(arm.forearm.position.toArray()).toEqual([0, -lean.proportions.upperArmLength, 0]);
      expect(arm.hand.parent).toBe(arm.forearm);
      expect(arm.hand.position.toArray()).toEqual([0, -lean.proportions.forearmLength, 0]);
      expect(arm.fingers).toHaveLength(5);
      for (const chain of arm.fingers) {
        expect(chain).toHaveLength(3);
        expect(chain[0].parent).toBe(arm.hand);
        expect(chain[1].parent).toBe(chain[0]);
        expect(chain[2].parent).toBe(chain[1]);
      }
      expect(arm.fingers[1][0].position.y).toBeCloseTo(-lean.proportions.handSize * HAND_KNUCKLE_OFFSET_RATIO);
    }

    rig.dispose();
  });

  test("winds side walls and caps outward while preserving an open cuff option", () => {
    const open = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, false);
    const closed = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, true);
    const position = requireBufferAttribute(closed, "position");
    const normal = requireBufferAttribute(closed, "normal");
    const radialDot = position.getX(0) * normal.getX(0) + position.getZ(0) * normal.getZ(0);
    const topCenter = position.count - 2;
    const bottomCenter = position.count - 1;

    expect(radialDot).toBeGreaterThan(0);
    expect(normal.getY(topCenter)).toBeGreaterThan(0.99);
    expect(normal.getY(bottomCenter)).toBeLessThan(-0.99);
    expect(open.getAttribute("position").count).toBe(24);
    expect(closed.getAttribute("position").count).toBe(26);
    open.dispose();
    closed.dispose();
  });

  test("keeps a bent shoulder-to-wrist surface continuous with finite deformation", () => {
    const rig = createCharacterRig(lean.proportions, lean.appearance);
    const arm = rig.arms.right;
    const armSkin = requireSkinnedMesh(rig.root, "rightArmSkin");
    const position = requireBufferAttribute(armSkin.geometry, "position");

    arm.upper.rotation.z = -0.65;
    arm.forearm.rotation.z = 2.35;
    rig.root.updateMatrixWorld(true);
    armSkin.skeleton.update();

    const deformed = new Vector3();
    const deformedVertices: Vector3[] = [];
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      deformed.fromBufferAttribute(position, vertex);
      armSkin.applyBoneTransform(vertex, deformed);
      expect(Number.isFinite(deformed.x) && Number.isFinite(deformed.y) && Number.isFinite(deformed.z)).toBe(true);
      deformedVertices.push(deformed.clone());
    }
    for (let ring = 0; ring < 7; ring += 1) {
      const ringStart = ring * 12;
      const seamLength = deformedVertices[ringStart].distanceTo(deformedVertices[ringStart + 11]);
      let longestInteriorEdge = 0;
      for (let segment = 0; segment < 11; segment += 1) {
        longestInteriorEdge = Math.max(
          longestInteriorEdge,
          deformedVertices[ringStart + segment].distanceTo(deformedVertices[ringStart + segment + 1]),
        );
      }
      expect(seamLength).toBeLessThanOrEqual(longestInteriorEdge * 1.01);
    }


    const fingerSkin = requireSkinnedMesh(rig.root, "rightFinger2");
    arm.fingers[2][0].rotation.x = 0.7;
    arm.fingers[2][1].rotation.x = 0.9;
    arm.fingers[2][2].rotation.x = 0.8;
    rig.root.updateMatrixWorld(true);
    fingerSkin.skeleton.update();
    const fingerPosition = requireBufferAttribute(fingerSkin.geometry, "position");
    for (let vertex = 0; vertex < fingerPosition.count; vertex += 1) {
      deformed.fromBufferAttribute(fingerPosition, vertex);
      fingerSkin.applyBoneTransform(vertex, deformed);
      expect(Number.isFinite(deformed.x) && Number.isFinite(deformed.y) && Number.isFinite(deformed.z)).toBe(true);
    }

    rig.dispose();
  });

  test("rejects malformed and physically contradictory inputs", () => {
    expect(() => validateBodyProportions({ ...lean.proportions, handSize: Number.NaN })).toThrow("proportions.handSize");
    expect(() => validateBodyProportions({ ...lean.proportions, torsoLength: 0 })).toThrow("proportions.torsoLength");
    expect(() => validateBodyProportions({ ...lean.proportions, shoulderSlope: -0.01 })).toThrow("proportions.shoulderSlope");
    expect(() => validateBodyProportions({ ...lean.proportions, shoulderSlope: 0 })).not.toThrow();
    expect(() => validateBodyProportions({ ...lean.proportions, shoulderWidth: lean.proportions.chestWidth - 0.01 })).not.toThrow();
    expect(() => validateBodyProportions({ ...lean.proportions, shirtClearance: lean.proportions.forearmRadius * 2 })).not.toThrow();
    expect(() => validateBodyProportions({ ...lean.proportions, neckWidth: lean.proportions.shoulderWidth })).toThrow("proportions.neckWidth");
    expect(() => createCharacterRig(lean.proportions, { ...lean.appearance, skin: "" })).toThrow("appearance.skin");
  });

  test("disposes every generated geometry once and detaches generated content", () => {
    const rig = createCharacterRig(lean.proportions, lean.appearance);
    const geometries: BufferGeometry[] = [];
    let disposalEvents = 0;
    rig.root.traverse((object) => {
      if (object instanceof SkinnedMesh) {
        geometries.push(object.geometry);
        object.geometry.addEventListener("dispose", () => {
          disposalEvents += 1;
        });
      }
    });

    rig.dispose();
    expect(disposalEvents).toBe(geometries.length);
    expect(rig.root.children).toHaveLength(0);
    rig.dispose();
    expect(disposalEvents).toBe(geometries.length);
  });
});

