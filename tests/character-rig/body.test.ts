import { describe, expect, test } from "bun:test";
import { BufferGeometry, SkinnedMesh } from "three";
import { createCharacterRig, createProfileGeometry, validateBodyShape } from "../../src/components/CharacterRig/body";
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
    }

    const meshes: SkinnedMesh[] = [];
    rig.root.traverse((object) => {
      if (object instanceof SkinnedMesh) meshes.push(object);
    });
    expect(meshes.some((mesh) => mesh.name === "leftOpenSleeve")).toBe(true);
    expect(meshes.some((mesh) => mesh.name === "rightPalm")).toBe(true);
    expect(meshes.filter((mesh) => mesh.name.includes("Finger"))).toHaveLength(40);
    for (const mesh of meshes) {
      expect(mesh.geometry.getAttribute("skinIndex")).toBeDefined();
      expect(mesh.geometry.getAttribute("skinWeight")).toBeDefined();
    }

    rig.dispose();
  });

  test("leaves both ends open when generating a cuff", () => {
    const open = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, false);
    const closed = createProfileGeometry([[0, 0.2, 0.2], [-0.4, 0.16, 0.16]], 0, true);

    expect(open.getAttribute("position").count).toBe(24);
    expect(closed.getAttribute("position").count).toBe(26);
    expect(open.getIndex()!.count).toBe(72);
    expect(closed.getIndex()!.count).toBe(144);
    open.dispose();
    closed.dispose();
  });

  test("rejects malformed and physically contradictory inputs", () => {
    expect(() => validateBodyShape({ ...lean.shape, handSize: Number.NaN })).toThrow("shape.handSize");
    expect(() => validateBodyShape({ ...lean.shape, torsoLength: 0 })).toThrow("shape.torsoLength");
    expect(() => validateBodyShape({ ...lean.shape, shoulderSlope: -0.01 })).toThrow("shape.shoulderSlope");
    expect(() => validateBodyShape({ ...lean.shape, shoulderSlope: 0 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, shoulderWidth: lean.shape.chestWidth - 0.01 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, shirtClearance: lean.shape.forearmRadius * 2 })).not.toThrow();
    expect(() => validateBodyShape({ ...lean.shape, neckWidth: lean.shape.shoulderWidth })).toThrow(
      "shape.neckWidth",
    );
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
  test("provide independently modeled lean and full bodies with reachable edge grips", () => {
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
      for (const side of ["left", "right"] as const) {
        expect(preset.pose[side].position[0]).toBe(0);
        const shoulderX = preset.pose.torsoPosition[0] + (side === "left" ? -1 : 1) * preset.shape.shoulderWidth / 2;
        const shoulderY = preset.pose.torsoPosition[1];
        const [targetX, targetY, targetZ] = preset.pose[side].position;
        const reach = Math.hypot(targetX - shoulderX, targetY - shoulderY, targetZ);
        const maximum = preset.shape.upperArmLength + preset.shape.forearmLength;
        const minimum = Math.abs(preset.shape.upperArmLength - preset.shape.forearmLength);
        expect(reach).toBeGreaterThan(minimum);
        expect(reach).toBeLessThan(maximum);
      }
    }
  });
});
