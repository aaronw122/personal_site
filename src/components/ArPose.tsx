import { useRef } from "react";
import "./arPoseSim.css";
import useLazyMount from "../hooks/useLazyMount";

function variant(source: string): string {
  if (/example:\s*cup-scale/.test(source)) return "cup-scale";
  if (/example:\s*cup/.test(source)) return "cup";
  return /col:\s*[0-3]/.test(source) ? "col" : "full";
}

export default function ArPose({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);

  useLazyMount(
    container,
    async (element) => {
      const { mountArPose } = await import("./arPoseSim.js");
      return mountArPose(source, element);
    },
    [source],
  );

  return <div ref={container} className="ar-pose-host" data-variant={variant(source)} />;
}
