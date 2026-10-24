// Dev-only playground for the raymarched shader in components/bob3 (route
// registered only when import.meta.env.DEV). ?t=<seconds> freezes the
// animation, ?yaw=<radians> sets the starting angle, ?focus=1 frames a
// close-up of the head, ?aa=1|2 forces the supersampling level.
import { useSearchParams } from "react-router-dom";
import BobShader from "../components/bob3/BobShader";

export default function Bob3Demo() {
  const [params] = useSearchParams();
  const t = params.get("t");
  const yaw = params.get("yaw");
  const focus = params.get("focus");
  const aa = params.get("aa");
  return (
    <div>
      <h2>bob 3</h2>
      <p>drag to spin him, click to bobble his head.</p>
      <BobShader
        freezeAt={t === null ? undefined : Number(t)}
        initialYaw={yaw === null ? undefined : Number(yaw)}
        focus={focus === null ? undefined : Number(focus)}
        aa={aa === "1" ? 1 : aa === "2" ? 2 : undefined}
      />
    </div>
  );
}
