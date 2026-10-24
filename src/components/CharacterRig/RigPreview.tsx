import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createCharacterRig } from "./body";
import { applyPeekPose, createPoseScratch } from "./pose";
import type { CharacterConfig, PoseStatus } from "./types";

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

export default function RigPreview({ config, mode, debug, native = false, onStatus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ config, mode, debug, onStatus });
  live.current = { config, mode, debug, onStatus };
  const [error, setError] = useState("");
  // Only geometry/material edits recreate the assembly; pose edits update existing bones.
  const assemblyKey = JSON.stringify([config.shape, config.appearance]);

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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x66717b, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(-3, 5, 6);
    scene.add(light);
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.01, 100);
    camera.position.set(0, 0, 10);
    const initial = live.current.config;
    const rig = createCharacterRig(initial.shape, initial.appearance);
    const releaseHead = addNeutralHead(rig.headMount);
    scene.add(rig.root);
    const helper = new THREE.SkeletonHelper(rig.root);
    scene.add(helper);
    const targetGeometry = new THREE.SphereGeometry(0.035, 10, 8);
    const targetMaterial = new THREE.MeshBasicMaterial({ color: "#d94949", depthTest: false });
    const targets = [new THREE.Mesh(targetGeometry, targetMaterial), new THREE.Mesh(targetGeometry, targetMaterial)];
    scene.add(...targets);
    const scratch = createPoseScratch();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastStatus = "";
    let previous = -Infinity;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || time - previous < 33) return;
      previous = time;
      const current = live.current;
      const pose = current.config.pose;
      const turn = current.mode === "left" ? -1 : current.mode === "right" ? 1 :
        current.mode === "centre" || motion.matches ? 0 : Math.sin(time / 1000 * Math.PI * 2 / pose.cycleSeconds);
      const status = applyPeekPose(rig, pose, turn, scratch);
      const statusKey = `${status.left.reachable}:${status.right.reachable}`;
      if (statusKey !== lastStatus) {
        lastStatus = statusKey;
        current.onStatus?.({ left: { ...status.left }, right: { ...status.right } });
      }
      helper.visible = current.debug;
      targets.forEach((target, index) => {
        target.visible = current.debug;
        target.position.fromArray(index ? pose.right.position : pose.left.position);
        target.position.x += pose.edgeX;
      });
      camera.right = pose.edgeX;
      camera.left = pose.edgeX - width / pixelsPerUnit;
      camera.top = 2.2;
      camera.bottom = camera.top - height / pixelsPerUnit;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    setError("");
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      releaseHead();
      rig.dispose();
      helper.geometry.dispose();
      const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
      materials.forEach((material) => material.dispose());
      targetGeometry.dispose();
      targetMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [assemblyKey, native]);

  return <div>
    {error && <p role="alert">Preview unavailable: {error}</p>}
    <div ref={host} data-rig-preview={native ? "native" : "detail"} style={{ boxSizing: "content-box", width: native ? 320 : 440, height: native ? 410 : 560, borderRight: "2px solid #ce4949", background: "#e8e5df" }} />
  </div>;
}
