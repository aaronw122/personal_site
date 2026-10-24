import { useState } from "react";
import BobPeek from "../components/BobPeek";

export default function PeekDemo() {
  const [hands, setHands] = useState<"scan" | "cartoon">("cartoon");
  const [headTurn, setHeadTurn] = useState<"auto" | "left" | "centre" | "right">("auto");
  return (
    <main style={{ minHeight: "170vh", padding: "5rem clamp(2rem, 8vw, 8rem)", color: "#334655", background: "#f3f5f1" }}>
      <h1>Bob at the window</h1>
      <p>Review his head turn and which fingers feel at home on the edge.</p>
      <fieldset style={{ display: "flex", gap: 16, flexWrap: "wrap", maxWidth: 630, padding: 18 }}>
        <legend>Hands</legend>
        <label><input type="radio" checked={hands === "scan"} onChange={() => setHands("scan")} /> Scan</label>
        <label><input type="radio" checked={hands === "cartoon"} onChange={() => setHands("cartoon")} /> Cartoon</label>
      </fieldset>
      <fieldset style={{ display: "flex", gap: 16, flexWrap: "wrap", maxWidth: 630, padding: 18 }}>
        <legend>Head turn</legend>
        {(["auto", "left", "centre", "right"] as const).map((direction) => (
          <label key={direction}><input type="radio" checked={headTurn === direction} onChange={() => setHeadTurn(direction)} /> {direction}</label>
        ))}
      </fieldset>
      <section style={{ maxWidth: 590, lineHeight: 1.8, marginTop: "8rem" }}>
        <h2>A window onto the page</h2>
        <p>Bob leans around the window edge. Compare his cartoon and scanned hand options, then click him to see the familiar strumming loop.</p>
        <p>Move your pointer over Bob to see him lean closer. The close button sends him back behind the window.</p>
        <p>Scroll down and back up to review whether the peek stays comfortable alongside the page’s content.</p>
      </section>
      <BobPeek hands={hands} headTurn={headTurn} />
    </main>
  );
}
