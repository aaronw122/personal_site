// Dev-only playground for the Meshy GLB Bob Weir (route registered only when
// import.meta.env.DEV). ?yaw=<radians> sets the starting angle, ?raw=1 shows
// the unedited source model for comparison.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import BobAvatar from "../components/bob/BobAvatar";
import type { BobStats } from "../components/bob/bobModel";

export default function Bob2Demo() {
  const [params] = useSearchParams();
  const yaw = params.get("yaw");
  const [stats, setStats] = useState<BobStats | null>(null);
  return (
    <div>
      <h2>bob 2</h2>
      <p>drag to turn him around.</p>
      <BobAvatar
        initialYaw={yaw === null ? undefined : Number(yaw)}
        raw={params.get("raw") === "1"}
        onStats={setStats}
      />
      {stats && <pre data-testid="bob-stats" style={{ fontSize: 11, opacity: 0.6 }}>{JSON.stringify(stats)}</pre>}
    </div>
  );
}
