import * as THREE from "three";

export type HandLayout = {
  edgeX: number;
  headCenterY: number;
  headHeight: number;
  type: "scan" | "cartoon";
};

// The hands are authored in an edge frame: X=0 is the gripped vertical edge,
// +X is offscreen, and +Z faces the viewer. The scan is baked into that frame
// before it reaches this layout function.
const modelHeights = new WeakMap<THREE.Object3D, number>();
const bounds = new THREE.Box3();

function heightOf(hand: THREE.Object3D): number {
  let height = modelHeights.get(hand);
  if (height === undefined) {
    bounds.setFromObject(hand);
    height = bounds.max.y - bounds.min.y;
    modelHeights.set(hand, height);
  }
  return height;
}

/** Place two edge-frame hands without disturbing the loaded nodes' authored
 * transforms. Cartoon x=0 is the finger midpoint, so aligning the wrapper to
 * edgeX leaves the full dorsal plate, knuckles, and proximal segments visible. */
export function layoutPeekHands(upper: THREE.Object3D, lower: THREE.Object3D, layout: HandLayout): void {
  const handHeightRatio = layout.type === "scan" ? 0.32 : 0.33;
  const upperOffset = layout.headHeight * 0.54;
  const lowerOffset = layout.headHeight * 0.40;
  const upperScale = layout.headHeight * handHeightRatio / heightOf(upper);
  const lowerScale = layout.headHeight * handHeightRatio / heightOf(lower);

  upper.scale.setScalar(upperScale);
  lower.scale.setScalar(lowerScale);
  // The scan has no authored edge origin and needs a small inward reveal. The
  // cartoon mesh is authored around x=0 and must sit exactly on the viewport.
  const gripX = layout.type === "scan"
    ? layout.edgeX - layout.headHeight * 0.10
    : layout.edgeX;
  upper.position.set(gripX, layout.headCenterY + upperOffset, 0.36);
  lower.position.set(gripX, layout.headCenterY - lowerOffset, 0.36);
  upper.quaternion.identity();
  lower.quaternion.identity();
}
