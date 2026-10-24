import { describe, expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, SkinnedMesh, Vector3 } from "three";
import {
  createCharacterRig,
  createProfileGeometry,
  HAND_KNUCKLE_OFFSET_RATIO,
  validateBodyShape,
} from "../../src/components/CharacterRig/body";
import { CHARACTER_PRESETS } from "../../src/components/CharacterRig/presets";

const lean = CHARACTER_PRESETS.find((preset) => preset.id === "lean")!;
const full = CHARACTER_PRESETS.find((preset) => preset.id === "full")!;

describe("character body", () => {
  test("builds the documented bind hierarchy and articulated hands", () => {
    const rig = createCharacterRig(lean.shape, lean.appearance);

    expect(rig.torso.parent).toBe(rig.root);
    expect(rig.neck.parent).toBe(rig.torso);
    expect(rig.headMount.parent).toBe(rig.neck);
    expect(rig.headMount.position.y).toBe(lean.shape.neckLength);
    for (const [side, arm] of Object.entries(rig.arms)) {
      expect(arm.upper.parent).toBe(rig.torso);
      expect(arm.upper.position.x).toBe((side === "left" ? -1 : 1) * lean.shape.shoulderWidth / 2);
      expect(arm.forearm.parent).toBe(arm.upper);
      expect(arm.forearm.position.toArray()).toEqual([0, -lean.shape.upperArmLength, 0]);
      expect(arm.hand.parent).toBe(arm.forearm);
      expect(arm.hand.position.toArray()).toEqual([0, -lean.shape.forearmLength, 0]);
      expect(arm.fingers).toHaveLength(5);
      for (const chain of arm.fingers) {
        expect(chain).toHaveLength(3);
        expect(chain[0].parent).toBe(arm.hand);
        expect(chain[1].parent).toBe(chain[0]);
        expect(chain[2].parent).toBe(chain[1]);
      }
      expect(arm.fingers[1][0].position.y).toBeCloseTo(-lean.shape.handSize * HAND_KNUCKLE_OFFSET_RATIO);
    }


    const torsoSkin = rig.root.getObjectByName("shirtTorso") as SkinnedMesh;
    const torsoPosition = torsoSkin.geometry.getAttribute("position") as BufferAttribute;
    expect(torsoPosition.getX(12)).toBeCloseTo(lean.shape.shoulderWidth / 2);
    const sleeve = rig.root.getObjectByName("rightOpenSleeve") as SkinnedMesh;
    expect(sleeve.geometry.getAttribute("position").count).toBe(25);
    expect(sleeve.geometry.getIndex()!.count).toBe(108);
    rig.dispose();
  });

  test("winds side walls and caps outward while preserving an open cuff option", () => {
    const open = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, false);
    const closed = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, true);
    const position = closed.getAttribute("position") as BufferAttribute;
    const normal = closed.getAttribute("normal") as BufferAttribute;
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
    const rig = createCharacterRig(lean.shape, lean.appearance);
    const arm = rig.arms.right;
    const armSkin = rig.root.getObjectByName("rightArmSkin") as SkinnedMesh;
    const position = armSkin.geometry.getAttribute("position") as BufferAttribute;
    const indices = armSkin.geometry.getIndex()!;

    arm.upper.rotation.z = -0.65;
    arm.forearm.rotation.z = 2.35;
    rig.root.updateMatrixWorld(true);
    armSkin.skeleton.update();

    const deformed = new Vector3();
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      deformed.fromBufferAttribute(position, vertex);
      armSkin.applyBoneTransform(vertex, deformed);
      expect(Number.isFinite(deformed.x) && Number.isFinite(deformed.y) && Number.isFinite(deformed.z)).toBe(true);
    }

    const elbowBoundaryStart = 2 * 12;
    const elbowBoundaryEnd = 5 * 12;
    let crossesBlendRegion = false;
    for (let offset = 0; offset < indices.count; offset += 3) {
      const a = indices.getX(offset);
      const b = indices.getX(offset + 1);
      const c = indices.getX(offset + 2);
      const minimum = Math.min(a, b, c);
      const maximum = Math.max(a, b, c);
      if (minimum < elbowBoundaryStart && maximum >= elbowBoundaryStart) crossesBlendRegion = true;
      if (minimum < elbowBoundaryEnd && maximum >= elbowBoundaryEnd) crossesBlendRegion = true;
    }
    expect(crossesBlendRegion).toBe(true);

    const fingerSkin = rig.root.getObjectByName("rightFinger2") as SkinnedMesh;
    arm.fingers[2][0].rotation.x = 0.7;
    arm.fingers[2][1].rotation.x = 0.9;
    arm.fingers[2][2].rotation.x = 0.8;
    rig.root.updateMatrixWorld(true);
    fingerSkin.skeleton.update();
    const fingerPosition = fingerSkin.geometry.getAttribute("position") as BufferAttribute;
    for (let vertex = 0; vertex < fingerPosition.count; vertex += 1) {
      deformed.fromBufferAttribute(fingerPosition, vertex);
      fingerSkin.applyBoneTransform(vertex, deformed);
      expect(Number.isFinite(deformed.x) && Number.isFinite(deformed.y) && Number.isFinite(deformed.z)).toBe(true);
    }

    rig.dispose();
  });

  test("rejects malformed and physically contradictory inputs", () => {
    expect(() => validateBodyShape({ ...lean.shape, handSize: Number.NaN })).toThrow("shape.handSize");
    expect(() => validateBodyShape({ ...lean.shape, torsoLength: 0 })).toThrow("shape.torsoLength");
    expect(() => validateBodyShape({ ...lean.shape, shoulderSlope: -0.01 })).toThrow("shape.shoulderSlope");
    expect(() => validateBodyShape({ ...lean.shape, shoulderSlope: 0 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, shoulderWidth: lean.shape.chestWidth - 0.01 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, shirtClearance: lean.shape.forearmRadius * 2 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, neckWidth: lean.shape.shoulderWidth })).toThrow("shape.neckWidth");
    expect(() => createCharacterRig(lean.shape, { ...lean.appearance, skin: "" })).toThrow("appearance.skin");
  });

  test("disposes every generated geometry once and detaches generated content", () => {
    const rig = createCharacterRig(lean.shape, lean.appearance);
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

describe("character presets", () => {
  test("provide independently modeled lean and full bodies", () => {
    expect(full.shape.bellyWidth / full.shape.chestWidth).toBeGreaterThan(
      lean.shape.bellyWidth / lean.shape.chestWidth,
    );
    expect(full.shape.bellyDepth / full.shape.chestDepth).toBeGreaterThan(
      lean.shape.bellyDepth / lean.shape.chestDepth,
    );
    expect(full.shape.upperArmRadius).not.toBe(lean.shape.upperArmRadius);
    expect(full.shape.forearmLength).not.toBe(lean.shape.forearmLength);
    expect(full.shape.handSize).not.toBe(lean.shape.handSize);
    for (const preset of CHARACTER_PRESETS) {
      expect(preset.head).toBeNull();
      expect(preset.pose.edgeX).toBe(0);
      expect(preset.shape.handSize * (HAND_KNUCKLE_OFFSET_RATIO + 0.48)).toBeLessThan(0.35);
    }
  });
});
