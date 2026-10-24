// Dev-only page showing the strumming musicians (route registered only when
// import.meta.env.DEV): Bob Weir (original scan), Neil Young (model 8), Jerry
// Garcia (model 9) and Bob Dylan (model 12), all rendered with the same strum
// loop and look. They play through the peek's StrumPlayer, so they share its
// clock and the tuner's loop length (strum.json) and strum in time with the
// peeking Bob when he's clicked.
import { useState } from "react";
import StrumPlayer from "../components/BobPeek/StrumPlayer";

const MUSICIANS = [
  { src: "/images/bob/strum-sheet.webp", label: "Cartoon Bob Weir playing guitar" },
  { src: "/images/bob/strum-sheet-neil.webp", label: "Cartoon Neil Young in sunglasses playing a white guitar" },
  { src: "/images/bob/strum-sheet-jerry.webp", label: "Cartoon Jerry Garcia in a floral shirt playing guitar" },
  { src: "/images/bob/strum-sheet-dylan.webp", label: "Cartoon Bob Dylan with a harmonica rack playing acoustic guitar" },
];

export default function Bob4Demo() {
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  return (
    <div>
      <h2>bob 4</h2>
      <p>Bob Weir, Neil Young, Jerry Garcia, Bob Dylan, at the peek's strum speed.</p>
      {/* two per row: the page's content column is ~620px wide */}
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {MUSICIANS.map((m) => (
          <StrumPlayer key={m.src} width={300} reduced={reduced} src={m.src} label={m.label} />
        ))}
      </div>
    </div>
  );
}
