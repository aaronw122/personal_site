import { useRef } from "react";
import "./uwbPulseSim.css";
import useLazyMount from "../hooks/useLazyMount";

export default function UwbPulse() {
  const container = useRef<HTMLDivElement>(null);

  useLazyMount(
    container,
    // Fetched only when the block nears the viewport, keeping it out of the article chunk.
    async (element) => {
      const { mountUwbPulse } = await import("./uwbPulseSim.js");
      element.style.aspectRatio = "";
      return mountUwbPulse(element);
    },
    [],
  );

  return <div ref={container} style={{ aspectRatio: "1620 / 390" }} />;
}
