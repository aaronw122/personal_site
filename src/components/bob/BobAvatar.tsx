// 3D Bob Weir figurine. The GLB is fixed up at load (stand removed, leg
// re-posed; see bobModel.ts) and lit as a painted vinyl toy. Drag to orbit.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { loadBobModel, type BobStats } from "./bobModel";

const MODEL_URL = "/models/bob.glb";

interface Props {
  width?: number;
  height?: number;
  /** Starting orbit angle around the figure, radians. */
  initialYaw?: number;
  /** Show the untouched source model, for comparison. */
  raw?: boolean;
  onStats?: (stats: BobStats) => void;
}

export default function BobAvatar({ width = 360, height = 600, initialYaw = 0.35, raw = false, onStats }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;

    const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
    key.position.set(-1.6, 2.4, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -1.2;
    key.shadow.camera.right = key.shadow.camera.top = 1.2;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.01;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd4ff, 1.4);
    rim.position.set(1.8, 1.2, -2.0);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 50);
    const target = new THREE.Vector3(0, 0.02, 0);
    camera.position.set(Math.sin(initialYaw) * 4.6, 0.45, Math.cos(initialYaw) * 4.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 7;
    controls.update();

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    loadBobModel(MODEL_URL, !raw)
      .then((mesh) => {
        if (disposed) {
          mesh.geometry.dispose();
          return;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        // soft contact shadow on an invisible floor
        const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = mesh.geometry.boundingBox!.min.y + 0.001;
        floor.receiveShadow = true;
        scene.add(floor);
        if (mesh.userData.stats) onStats?.(mesh.userData.stats as BobStats);
        setStatus("ready");
        tick();
      })
      .catch((err) => {
        console.error(err);
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.MeshStandardMaterial;
          for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) t?.dispose();
          mat.dispose();
        }
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [width, height, initialYaw, raw, onStats]);

  return (
    <div
      ref={hostRef}
      data-status={status}
      role="img"
      aria-label="3D Bob Weir figurine playing guitar. Drag to turn him around"
      style={{ width, height, position: "relative", cursor: "grab", touchAction: "none" }}
    >
      {status !== "ready" && (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.5 }}>
          {status === "loading" ? "loading bob…" : "couldn't load bob"}
        </span>
      )}
    </div>
  );
}
