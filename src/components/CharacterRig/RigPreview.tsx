import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createCharacterRig } from "./body";
import { applyPeekPose, createPoseScratch } from "./pose";
import type { CharacterConfig, CharacterRig, PoseStatus } from "./types";

export type TurnMode = "auto" | "left" | "centre" | "right";
type Props = {
  config: CharacterConfig;
  mode: TurnMode;
  debug: boolean;
  native?: boolean;
  onStatus?: (status: PoseStatus) => void;
};

/** Deliberately neutral: eye and nose markers make head rotation inspectable. */
function addNeutralHead(mount: THREE.Group) {
  const material = new THREE.MeshStandardMaterial({ color: "#c4cbd0", roughness: 0.8 });
  const marker = new THREE.MeshStandardMaterial({ color: "#394650" });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), material);
  head.scale.set(0.8, 1, 0.8);
  head.position.y = 0.5;
  mount.add(head);
  const eyes = new THREE.SphereGeometry(0.035, 10, 8);
  for (const x of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(eyes, marker);
    eye.position.set(x, 0.57, 0.36);
    mount.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), material);
  nose.position.set(0, 0.43, 0.4);
  nose.scale.z = 1.5;
  mount.add(nose);
  return () => {
    head.geometry.dispose();
    eyes.dispose();
    nose.geometry.dispose();
    material.dispose();
    marker.dispose();
  };
}
type Assembly = {
  rig: CharacterRig;
  helper: THREE.SkeletonHelper;
  releaseHead(): void;
  proportions: CharacterConfig["proportions"];
};

function disposeAssembly(scene: THREE.Scene, assembly: Assembly) {
  scene.remove(assembly.rig.root, assembly.helper);
  assembly.releaseHead();
  assembly.rig.dispose();
  assembly.helper.geometry.dispose();
  const materials = Array.isArray(assembly.helper.material) ? assembly.helper.material : [assembly.helper.material];
  materials.forEach((material) => material.dispose());
}

function setAssemblyColors(assembly: Assembly, appearance: CharacterConfig["appearance"]) {
  assembly.rig.root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const color = object.name === "shirtTorso" || object.name.endsWith("OpenSleeve") ? appearance.shirt : appearance.skin;
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) material.color.set(color);
    });
  });
}
function sameStatus(left: PoseStatus | null, right: PoseStatus) {
  return left !== null && (["left", "right"] as const).every((side) =>
    left[side].reachable === right[side].reachable &&
    left[side].distance === right[side].distance &&
    left[side].minimum === right[side].minimum &&
    left[side].maximum === right[side].maximum);
}

export default function RigPreview({ config, mode, debug, native = false, onStatus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ config, mode, debug, onStatus });
  const sceneRef = useRef<THREE.Scene | null>(null);
  const assemblyRef = useRef<Assembly | null>(null);
  live.current = { config, mode, debug, onStatus };
  const [error, setError] = useState("");

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (cause) {
      setError(String(cause));
      return;
    }
    const width = native ? 320 : 440;
    const height = native ? 410 : 560;
    const pixelsPerUnit = native ? 48 : 150;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x66717b, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(-3, 5, 6);
    scene.add(light);
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.01, 100);
    camera.position.set(0, 0, 10);

    const initial = live.current.config;
    const rig = createCharacterRig(initial.proportions, initial.appearance);
    const assembly: Assembly = {
      rig,
      helper: new THREE.SkeletonHelper(rig.root),
      releaseHead: addNeutralHead(rig.headMount),
      proportions: initial.proportions,
    };
    assemblyRef.current = assembly;
    scene.add(rig.root, assembly.helper);

    const targetGeometry = new THREE.SphereGeometry(0.035, 10, 8);
    const targetMaterial = new THREE.MeshBasicMaterial({ color: "#d94949", depthTest: false });
    const targets = [new THREE.Mesh(targetGeometry, targetMaterial), new THREE.Mesh(targetGeometry, targetMaterial)];
    scene.add(...targets);
    const scratch = createPoseScratch();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastStatus: PoseStatus | null = null;
    let previous = -Infinity;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || time - previous < 33) return;
      previous = time;
      const current = live.current;
      const currentAssembly = assemblyRef.current;
      if (!currentAssembly) return;
      const pose = current.config.pose;
      const turn = current.mode === "left" ? -1 : current.mode === "right" ? 1 :
        current.mode === "centre" || motion.matches ? 0 : Math.sin(time / 1000 * Math.PI * 2 / pose.cycleSeconds);
      const status = applyPeekPose(currentAssembly.rig, pose, turn, scratch);
      if (!sameStatus(lastStatus, status)) {
        lastStatus = { left: { ...status.left }, right: { ...status.right } };
        current.onStatus?.(lastStatus);
      }
      currentAssembly.helper.visible = current.debug;
      targets.forEach((target, index) => {
        target.visible = current.debug;
        target.position.fromArray(index ? pose.right.position : pose.left.position);
        target.position.x += pose.edgeX;
      });
      camera.right = pose.edgeX;
      camera.left = pose.edgeX - width / pixelsPerUnit;
      camera.top = native ? 5.8 : 2.2;
      camera.bottom = camera.top - height / pixelsPerUnit;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    setError("");
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      const currentAssembly = assemblyRef.current;
      if (currentAssembly) disposeAssembly(scene, currentAssembly);
      assemblyRef.current = null;
      sceneRef.current = null;
      targetGeometry.dispose();
      targetMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [native]);

  useEffect(() => {
    const scene = sceneRef.current;
    const previous = assemblyRef.current;
    if (!scene || !previous || previous.proportions === config.proportions) return;
    const current = live.current.config;
    const rig = createCharacterRig(current.proportions, current.appearance);
    const next: Assembly = {
      rig,
      helper: new THREE.SkeletonHelper(rig.root),
      releaseHead: addNeutralHead(rig.headMount),
      proportions: current.proportions,
    };
    scene.add(rig.root, next.helper);
    assemblyRef.current = next;
    disposeAssembly(scene, previous);
  }, [config.proportions]);

  useEffect(() => {
    const assembly = assemblyRef.current;
    if (assembly) setAssemblyColors(assembly, config.appearance);
  }, [config.appearance]);

  return <div>
    {error && <p role="alert">Preview unavailable: {error}</p>}
    <div ref={host} data-rig-preview={native ? "native" : "detail"} style={{ boxSizing: "content-box", width: native ? 320 : 440, height: native ? 410 : 560, borderRight: "2px solid #ce4949", background: "#e8e5df" }} />
  </div>;
}
