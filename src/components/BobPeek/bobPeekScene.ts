import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cartoonize } from "./bobMaterial";
import { layoutPeekHands } from "./peekHands";

/** Approximate displayed head width at the 410px-tall review canvas. */
export const HEAD_SCREEN_SIZE_PX = 48;
const HEAD_SCALE = HEAD_SCREEN_SIZE_PX / 240;
const HEAD_BASE_Y = 0.24;
const HEAD_ROLL = THREE.MathUtils.degToRad(30);
const HOVER_ROLL_LEAN = THREE.MathUtils.degToRad(3);
const RESTING_HEAD_YAW = 0;
const HEAD_YAW_RANGE = THREE.MathUtils.degToRad(10);
const HEAD_SILHOUETTE_YAW_RANGE = THREE.MathUtils.degToRad(16);
const HIDDEN_HEAD_SHARE = 0.06;

/** Measure the head and hair in their rendered world orientation, omitting the
 * shirt/shoulders baked into the same source mesh below the collar. */
function visibleHeadBounds(face: THREE.Mesh): THREE.Box3 {
  face.updateWorldMatrix(true, false);
  const position = face.geometry.getAttribute("position");
  const point = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i);
    if (point.y >= HEAD_BASE_Y) box.expandByPoint(point.applyMatrix4(face.matrixWorld));
  }
  return box;
}

const NECK = new THREE.Vector3(0.0985, 0.0776, 0.9921).normalize();
/** Rotate the scan's guitar-neck grip axis onto the local vertical edge axis,
 * then turn its dorsal knuckles toward +Z so the curled fingertips face away
 * from the viewer and wrap behind the browser edge. */
export function scanHandEdgeTransform(hand: THREE.Object3D) {
  const grip = new THREE.Vector3(0.128, 0.111, 0.315);
  const rotate = new THREE.Quaternion().setFromUnitVectors(NECK, new THREE.Vector3(0, 1, 0));
  const align = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  hand.quaternion.copy(align.multiply(rotate));
  hand.scale.setScalar(0.40);
  hand.position.copy(grip.applyQuaternion(hand.quaternion).multiplyScalar(-0.40));
}

// glTF quantization keeps vertex positions in a normalized mesh frame; expand
// attributes before applying the node's world transform to avoid integer rounding.
function worldGeometry(mesh: THREE.Mesh) {
  mesh.updateWorldMatrix(true, false);
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(mesh.geometry.getIndex());
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      values[i * attribute.itemSize] = attribute.getX(i);
      if (attribute.itemSize > 1) values[i * attribute.itemSize + 1] = attribute.getY(i);
      if (attribute.itemSize > 2) values[i * attribute.itemSize + 2] = attribute.getZ(i);
      if (attribute.itemSize > 3) values[i * attribute.itemSize + 3] = attribute.getW(i);
    }
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
  }
  geometry.applyMatrix4(mesh.matrixWorld);
  return geometry;
}

/** Keep the scan's head/hair while dropping its baked shirt and shoulders. The
 * collar boundary sits behind the beard and lower grip instead of leaving a
 * torn-looking mesh edge below the hand. */
function removeBakedShirt(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const source = geometry.getIndex();
  if (!source) return;
  const kept: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const a = source.getX(i), b = source.getX(i + 1), c = source.getX(i + 2);
    if (position.getY(a) >= HEAD_BASE_Y && position.getY(b) >= HEAD_BASE_Y && position.getY(c) >= HEAD_BASE_Y) {
      kept.push(a, b, c);
    }
  }
  geometry.setIndex(kept);
}
/** Remove every scan triangle that samples the dark-brown leather cuff at any
 * vertex. Removing mixed boundary triangles clears sub-pixel cuff flecks too. */
function removeScanHandCuff(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
  const uv = geometry.getAttribute("uv");
  const source = geometry.getIndex();
  const image = material.map?.image as CanvasImageSource & { width: number; height: number };
  if (!source || !uv || !image?.width || !image.height) return;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const isLeather = (vertex: number) => {
    const x = Math.floor(THREE.MathUtils.euclideanModulo(uv.getX(vertex), 1) * canvas.width);
    const y = Math.floor(THREE.MathUtils.euclideanModulo(uv.getY(vertex), 1) * canvas.height);
    const offset = (y * canvas.width + x) * 4;
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    return r >= 33 && r <= 118 && g > 20 && g < 86 && b < 69 && r > g * 1.22 && g > b * 1.08;
  };
  const kept: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const a = source.getX(i), b = source.getX(i + 1), c = source.getX(i + 2);
    const leatherVertices = Number(isLeather(a)) + Number(isLeather(b)) + Number(isLeather(c));
    if (leatherVertices === 0) kept.push(a, b, c);
  }
  geometry.setIndex(kept);
}


/** Face orientation measured from the baked scan's eye/nose skin vertices.
 * Eye-centre axis establishes screen horizontal so the correction does not
 * accidentally roll Bob while aiming the face toward +Z. */
export function faceForwardFromScan(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const forward = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let samples = 0;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (x < -0.29 || x > -0.07 || y < 0.35 || y > 0.57 || z < 0.12 || z > 0.37) continue;
    normal.fromBufferAttribute(normals, i);
    if (normal.z < 0) continue;
    forward.add(normal);
    samples++;
  }
  if (!samples) throw new Error("Bob's face normals were not found in the scan");
  return forward.normalize();
}

export function scanFaceForwardRotation(geometry: THREE.BufferGeometry) {
  const forward = faceForwardFromScan(geometry);
  const right = new THREE.Vector3(0.130, 0.030, 0.007);
  right.addScaledVector(forward, -right.dot(forward)).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  right.crossVectors(up, forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward)).invert();
}

export type PeekScene = {
  element: HTMLCanvasElement;
  draw: (time: number, turn: number, hover: boolean, motion: boolean) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

/** Join tapered segments into one smooth arm. Segment caps overlap inside the
 * sleeve, elbow and hand, so no cut end is exposed to the camera. */
function bentArmGeometry(points: THREE.Vector3[], radii: number[]) {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i], end = points[i + 1];
    const direction = new THREE.Vector3().subVectors(end, start);
    const geometry = new THREE.CylinderGeometry(radii[i + 1], radii[i], direction.length(), 24, 5, false);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    pieces.push(geometry);
    if (i > 0) {
      const joint = new THREE.SphereGeometry(radii[i], 24, 16);
      joint.translate(start.x, start.y, start.z);
      pieces.push(joint);
    }
  }
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((piece) => piece.dispose());
  return merged;
}

function sleeveGeometry(root: THREE.Vector3, exit: THREE.Vector3, radius: number) {
  const direction = new THREE.Vector3().subVectors(exit, root);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius * .88, radius, length, 24, 3, false);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate((root.x + exit.x) / 2, (root.y + exit.y) / 2, (root.z + exit.z) / 2);
  return geometry;
}

/** A low rounded shoulder mass that stays broad beneath the beard rather than
 * continuing down the edge as a narrow torso strip. */
function shoulderGeometry(center: THREE.Vector3, headHeight: number, scale = 1) {
  const geometry = new THREE.SphereGeometry(1, 28, 18);
  geometry.scale(headHeight * .42 * scale, headHeight * .19 * scale, headHeight * .13);
  geometry.translate(center.x, center.y, center.z);
  return geometry;
}

/** A short open cuff around the sleeve exit makes the arm visibly emerge from
 * fabric rather than from a rounded terminal. */
function sleeveHemGeometry(exit: THREE.Vector3, direction: THREE.Vector3, radius: number) {
  const axis = direction.normalize();
  const length = radius * .28;
  const geometry = new THREE.CylinderGeometry(radius * .84, radius * .92, length, 28, 1, true);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis));
  geometry.translate(
    exit.x - axis.x * length * .42,
    exit.y - axis.y * length * .42,
    exit.z - axis.z * length * .42 + radius * .08,
  );
  return geometry;
}

export async function createPeekScene(hands: "scan" | "cartoon"): Promise<PeekScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe4ff, 1.1);
  rim.position.set(-2.5, 1.5, -2.5);
  scene.add(rim);
  const camera = new THREE.OrthographicCamera(-0.43, 0.43, 0.56, -0.56, 0.01, 20);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const scan = await loader.loadAsync("/models/bob-peek.glb");
  const headSource = scan.scene.getObjectByName("head") as THREE.Mesh;
  const handSource = scan.scene.getObjectByName("hand") as THREE.Mesh;
  if (!headSource || !handSource) throw new Error("Bob peek model requires head and hand nodes");
  const resources: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textured = (source: THREE.Mesh, options?: Parameters<typeof cartoonize>[2]) => {
    const m = cartoonize(source.material as THREE.MeshStandardMaterial, renderer.capabilities.getMaxAnisotropy(), options);
    materials.push(m);
    return m;
  };
  const head = new THREE.Group();
  const headContent = new THREE.Group();
  const faceGeometry = worldGeometry(headSource);
  removeBakedShirt(faceGeometry);
  // The rebuilt node includes the stationary shirt and shoulders. Blend yaw
  // through the neck so only Bob's head and beard look around.
  const headYawAngle = { value: 0 };
  const face = new THREE.Mesh(faceGeometry, textured(headSource, {
    headYaw: {
      angle: headYawAngle,
      collarY: HEAD_BASE_Y,
      chinY: 0.35,
      pivotX: -0.18,
      pivotZ: 0.02,
      shirtStrap: true,
    },
  }));
  const correction = scanFaceForwardRotation(faceGeometry);
  headContent.quaternion.copy(correction);
  headContent.add(face);
  face.position.set(0.16, -0.455, -0.18);
  head.add(headContent);
  head.scale.setScalar(HEAD_SCALE);
  head.position.set(0.34, -0.10, 0.08);
  head.rotation.set(0, 0, HEAD_ROLL);
  scene.add(head);

  const handGeometry = worldGeometry(handSource);
  const edgeTransform = new THREE.Object3D();
  scanHandEdgeTransform(edgeTransform);
  edgeTransform.updateMatrix();
  handGeometry.applyMatrix4(edgeTransform.matrix);
  removeScanHandCuff(handGeometry, handSource.material as THREE.MeshStandardMaterial);
  let handMaterial = textured(handSource, { rimStrength: 0 });
  let cartoonScene: THREE.Group | undefined;
  let cartoonHands: { upper: THREE.Object3D; lower: THREE.Object3D } | undefined;
  if (hands === "cartoon") {
    try {
      const cartoon = await loader.loadAsync("/models/bob-hands-cartoon.glb");
      cartoonScene = cartoon.scene;
      const upper = cartoon.scene.getObjectByName("hand");
      if (!upper) throw new Error("No hand node");
      cartoonHands = {
        upper,
        lower: cartoon.scene.getObjectByName("handLower") ?? upper,
      };
      cartoon.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = cartoonize(
          object.material as THREE.MeshStandardMaterial,
          renderer.capabilities.getMaxAnisotropy(),
          { rimStrength: 0 },
        );
        material.side = THREE.DoubleSide;
        object.material = material;
        materials.push(material);
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn("Cartoon Bob hand unavailable; using scan hand", error);
    }
  }
  const handGroup = new THREE.Group();
  const createHand = (position: "upper" | "lower") => {
    const wrapper = new THREE.Group();
    if (cartoonHands) {
      wrapper.add(cartoonHands[position].clone(true));
    } else {
      const mesh = new THREE.Mesh(handGeometry, handMaterial);
      mesh.material.side = THREE.DoubleSide;
      wrapper.add(mesh);
    }
    return wrapper;
  };
  const upperHand = createHand("upper");
  const lowerHand = createHand("lower");
  handGroup.add(upperHand, lowerHand);
  scene.add(handGroup);
  let headBounds = visibleHeadBounds(face);
  let headCenter = headBounds.getCenter(new THREE.Vector3());
  let headHeight = headBounds.max.y - headBounds.min.y;
  let headRestX = head.position.x;
  const positionHead = () => {
    head.position.x = headRestX;
    headBounds = visibleHeadBounds(face);
    const headWidth = headBounds.max.x - headBounds.min.x;
    headRestX += camera.right + headWidth * HIDDEN_HEAD_SHARE - headBounds.max.x;
    head.position.x = headRestX;
    headBounds = visibleHeadBounds(face);
    headBounds.getCenter(headCenter);
    headHeight = headBounds.max.y - headBounds.min.y;
  };
  positionHead();
  // Match the textured face's warm orange-tan rendered midtone; the base is
  // tuned in-scene rather than copied from a nominal face texel.
  const armMaterial = cartoonize(new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(190 / 255, 150 / 255, 120 / 255, THREE.SRGBColorSpace),
    roughness: 0.72,
    metalness: 0,
  }), renderer.capabilities.getMaxAnisotropy(), { rimStrength: 0 });
  const sleeveMaterial = cartoonize(new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(176 / 255, 181 / 255, 190 / 255, THREE.SRGBColorSpace),
    roughness: 0.84,
    metalness: 0,
  }), renderer.capabilities.getMaxAnisotropy(), { rimStrength: 0 });
  const sleeveHemMaterial = cartoonize(new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(72 / 255, 83 / 255, 102 / 255, THREE.SRGBColorSpace),
    roughness: 0.88,
    metalness: 0,
  }), renderer.capabilities.getMaxAnisotropy(), { rimStrength: 0 });
  materials.push(armMaterial, sleeveMaterial, sleeveHemMaterial);
  const lowerArm = new THREE.Mesh(new THREE.BufferGeometry(), armMaterial);
  const lowerSleeve = new THREE.Mesh(new THREE.BufferGeometry(), sleeveMaterial);
  const shirtShoulder = new THREE.Mesh(new THREE.BufferGeometry(), sleeveMaterial);
  const shirtShoulderOutline = new THREE.Mesh(new THREE.BufferGeometry(), sleeveHemMaterial);
  const lowerSleeveHem = new THREE.Mesh(new THREE.BufferGeometry(), sleeveHemMaterial);
  const armGroup = new THREE.Group();
  armGroup.add(shirtShoulderOutline, shirtShoulder, lowerSleeve, lowerSleeveHem, lowerArm);
  scene.add(armGroup);
  let armGeometries: THREE.BufferGeometry[] = [];
  const positionArms = () => {
    for (const geometry of armGeometries) geometry.dispose();

    // A broad short sleeve leaves the shoulder below the beard. The bare upper
    // arm drops toward a round elbow, then a distinct forearm rises to the grip.
    const shoulderCenter = new THREE.Vector3(
      camera.right - headHeight * .28,
      headCenter.y - headHeight * .60,
      -.08,
    );
    // Bury the sleeve root inside the shoulder so its smooth fabric boundary
    // remains visible beneath the textured beard before the arm emerges.
    const sleeveRoot = new THREE.Vector3(
      camera.right - headHeight * .30,
      headCenter.y - headHeight * .62,
      .06,
    );
    const sleeveExit = new THREE.Vector3(
      camera.right - headHeight * .52,
      headCenter.y - headHeight * .72,
      .22,
    );
    const elbow = new THREE.Vector3(
      camera.right - headHeight * .45,
      headCenter.y - headHeight * 1.06,
      .30,
    );
    const forearmTurn = new THREE.Vector3(
      camera.right - headHeight * .42,
      headCenter.y - headHeight * .66,
      .35,
    );
    const lowerWrist = new THREE.Vector3(
      camera.right - headHeight * .18,
      headCenter.y - headHeight * .38,
      .36,
    );
    const sleeveRadius = headHeight * .15;
    const upperArmRadius = headHeight * .088;
    const elbowRadius = headHeight * .105;
    const wristRadius = headHeight * .012;
    armGeometries = [
      shoulderGeometry(new THREE.Vector3(shoulderCenter.x, shoulderCenter.y, shoulderCenter.z - .015), headHeight, 1.10),
      shoulderGeometry(shoulderCenter, headHeight),
      sleeveGeometry(sleeveRoot, sleeveExit, sleeveRadius),
      sleeveHemGeometry(sleeveExit, new THREE.Vector3().subVectors(sleeveExit, sleeveRoot), sleeveRadius),
      bentArmGeometry([sleeveExit, elbow, forearmTurn, lowerWrist], [upperArmRadius, elbowRadius, headHeight * .060, wristRadius]),
    ];
    shirtShoulderOutline.geometry = armGeometries[0];
    shirtShoulder.geometry = armGeometries[1];
    lowerSleeve.geometry = armGeometries[2];
    lowerSleeveHem.geometry = armGeometries[3];
    lowerArm.geometry = armGeometries[4];
  };
  const positionHands = () => layoutPeekHands(upperHand, lowerHand, {
    edgeX: camera.right,
    headCenterY: headCenter.y,
    headHeight,
    type: hands,
  });
  positionHands();
  positionArms();
  // The browser's actual right boundary masks the rest of the body.

  return {
    element: renderer.domElement,
    resize(width, height) {
      renderer.setSize(width, height, false);
      const worldHeight = 1.12;
      const worldWidth = worldHeight * width / height;
      camera.left = -worldWidth / 2;
      camera.right = worldWidth / 2;
      camera.top = worldHeight / 2;
      camera.bottom = -worldHeight / 2;
      camera.updateProjectionMatrix();
      positionHead();
      positionHands();
      positionArms();
    },
    draw(time, turn, hover, motion) {
      headYawAngle.value = RESTING_HEAD_YAW + turn * HEAD_YAW_RANGE;
      head.position.x = headRestX - (hover ? 0.013 : 0);
      head.position.y = -0.10 + (hover ? 0.007 : 0) + (motion ? Math.sin(time * 1.3) * 0.003 : 0);
      head.rotation.z = HEAD_ROLL - (hover ? HOVER_ROLL_LEAN : 0);
      head.rotation.y = turn * HEAD_SILHOUETTE_YAW_RANGE;
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      pmrem.dispose();
      environment.dispose();
      for (const geometry of resources) geometry.dispose();
      face.geometry.dispose();
      handGeometry.dispose();
      headSource.geometry.dispose();
      handSource.geometry.dispose();
      for (const geometry of armGeometries) geometry.dispose();
      if (cartoonScene) cartoonScene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => {
            if (!materials.includes(m)) m.dispose();
          });
        }
      });
      for (const material of materials) material.dispose();
      scan.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof THREE.MeshStandardMaterial) {
            for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) texture?.dispose();
          }
          material.dispose();
        }
      });
    },
  };
}
