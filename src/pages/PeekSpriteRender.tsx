import { useEffect, useRef } from "react";
import { renderPeekSprite } from "../components/AvatarStage/spriteRender";

export default function PeekSpriteRender() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("sprite") || "bob";
    const layer = new URLSearchParams(location.search).get("layer") === "hands" ? "hands" : "body";
    if (!canvas.current) return;
    void renderPeekSprite(canvas.current, id, layer).then(info => {
      document.documentElement.dataset.spriteInfo = JSON.stringify(info);
    }).catch(error => { document.documentElement.dataset.spriteError = String(error); });
  }, []);
  return <canvas ref={canvas} width={192} height={268} style={{ position: "fixed", left: 0, top: 0, width: 192, height: 268 }} />;
}
