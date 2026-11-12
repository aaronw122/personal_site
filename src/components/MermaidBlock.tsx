import { useId, useRef, useState } from "react";
import useLazyMount from "../hooks/useLazyMount";

let initialized = false;

export default function MermaidBlock({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const id = `mermaid-${useId().replace(/[^\w-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);

  useLazyMount(
    container,
    async () => {
      const { default: mermaid } = await import("mermaid");
      if (!initialized) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "Geist, sans-serif",
          securityLevel: "strict",
        });
        initialized = true;
      }
      try {
        const result = await mermaid.render(id, source);
        setSvg(result.svg);
      } catch (error) {
        console.error("mermaid render failed", error);
      }
      return () => {};
    },
    [id, source],
  );

  if (svg) return <div ref={container} className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
  return (
    <div ref={container} className="mermaid-block">
      <pre>
        <code>{source}</code>
      </pre>
    </div>
  );
}
