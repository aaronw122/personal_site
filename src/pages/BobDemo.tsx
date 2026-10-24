// Dev-only playground for the hand-built raymarched Bob Weir (route registered
// only when import.meta.env.DEV). ?t=<seconds> freezes the animation,
// ?yaw=<radians> sets the starting angle, ?focus=1 frames a close-up of the head.
import { useSearchParams } from "react-router-dom";
import BobRaymarch from "../components/bob/BobRaymarch";

export default function BobDemo() {
  const [params] = useSearchParams();
  const t = params.get("t");
  const yaw = params.get("yaw");
  const focus = params.get("focus");
  return (
    <div>
      <h2>bob</h2>
      <p>drag to spin him, click to bobble his head.</p>
      <BobRaymarch
        freezeAt={t === null ? undefined : Number(t)}
        initialYaw={yaw === null ? undefined : Number(yaw)}
        focus={focus === null ? undefined : Number(focus)}
      />
    </div>
  );
}
