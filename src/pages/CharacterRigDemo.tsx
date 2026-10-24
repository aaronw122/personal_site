import { useEffect, useState } from "react";
import RigPreview from "../components/CharacterRig/RigPreview";
import type { TurnMode } from "../components/CharacterRig/RigPreview";
import { CHARACTER_PRESETS } from "../components/CharacterRig/presets";
import { validateBodyProportions } from "../components/CharacterRig/body";
import type { BodyProportions, CharacterConfig, PoseStatus, Vec3 } from "../components/CharacterRig/types";

const proportionControls: { key: keyof BodyProportions; min: number; max: number }[] = [
  { key: "chestWidth", min: 0.5, max: 2 }, { key: "chestDepth", min: 0.3, max: 1.5 },
  { key: "bellyWidth", min: 0.5, max: 2.4 }, { key: "bellyDepth", min: 0.3, max: 1.8 },
  { key: "torsoLength", min: 0.7, max: 2 }, { key: "shoulderWidth", min: 0.5, max: 1.8 },
  { key: "shoulderSlope", min: 0, max: 0.4 }, { key: "neckWidth", min: 0.15, max: 0.6 },
  { key: "neckLength", min: 0.05, max: 0.5 }, { key: "upperArmLength", min: 0.4, max: 1.5 },
  { key: "forearmLength", min: 0.4, max: 1.5 }, { key: "upperArmRadius", min: 0.07, max: 0.3 },
  { key: "forearmRadius", min: 0.06, max: 0.25 }, { key: "handSize", min: 0.18, max: 0.6 },
  { key: "shirtClearance", min: 0.01, max: 0.15 },
];
const labelText = (value: string) => value.replace(/([A-Z])/g, " $1").toLowerCase();
function isTurnMode(value: string): value is TurnMode {
  return value === "auto" || value === "left" || value === "centre" || value === "right";
}
function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(value: number): void }) {
  return <label style={{ display: "grid", gridTemplateColumns: "1fr 52px", gap: 4 }}>
    <span>{label}</span><output>{value.toFixed(2)}</output>
    <input aria-label={label} style={{ gridColumn: "1 / -1", width: "100%" }} type="range" min={min} max={max} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}
function VectorControls({ label, value, onChange }: { label: string; value: Vec3; onChange(value: Vec3): void }) {
  return <fieldset><legend>{label}</legend>{([0, 1, 2] as const).map((axis) => <Slider key={axis} label={`${label} ${"xyz"[axis]}`} value={value[axis]} min={-3} max={3} onChange={(number) => {
    const next: Vec3 = [...value]; next[axis] = number; onChange(next);
  }} />)}</fieldset>;
}

export default function CharacterRigDemo() {
  const [config, setConfig] = useState<CharacterConfig>(() => structuredClone(CHARACTER_PRESETS[0]));
  const [mode, setMode] = useState<TurnMode>("centre");
  const [debug, setDebug] = useState(false);
  const [status, setStatus] = useState<PoseStatus | null>(null);
  const [reference, setReference] = useState("");
  const [referenceWidth, setReferenceWidth] = useState(440);
  const [referenceX, setReferenceX] = useState(0);
  const [referenceY, setReferenceY] = useState(0);
  const [opacity, setOpacity] = useState(0.35);
  const [exported, setExported] = useState("");
  const [proportionError, setProportionError] = useState("");
  const changeProportions = (key: keyof BodyProportions, value: number) => {
    const proportions = { ...config.proportions, [key]: value };
    try {
      validateBodyProportions(proportions);
      setProportionError("");
      setConfig({ ...config, proportions });
    } catch (error) {
      setProportionError(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => () => { if (reference) URL.revokeObjectURL(reference); }, [reference]);
  const changePose = (patch: Partial<CharacterConfig["pose"]>) => setConfig((current) => ({ ...current, pose: { ...current.pose, ...patch } }));
  const exportConfig = () => {
    const text = JSON.stringify(config, null, 2);
    setExported(text);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${config.id}-rig.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <main style={{ padding: 24, color: "#26313b", background: "#f4f1eb", minHeight: "100vh", font: "14px/1.4 system-ui" }}>
    <h1>Character rig workshop</h1>
    <p>Neutral body approval: lean and fuller proportions share one rig. Red boundary is the browser edge. One world unit equals the neutral head height.</p>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "start", gap: 24 }}>
      <aside style={{ width: 270, display: "grid", gap: 12 }}>
        <label>Body preset <select aria-label="Body preset" value={config.id} onChange={(event) => {
          const preset = CHARACTER_PRESETS.find((entry) => entry.id === event.target.value);
          if (preset) { setConfig(structuredClone(preset)); setStatus(null); setProportionError(""); }
        }}>{CHARACTER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
        <label>Head turn <select aria-label="Head turn" value={mode} onChange={(event) => { if (isTurnMode(event.target.value)) setMode(event.target.value); }}>{["auto", "left", "centre", "right"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> Bones and grip targets</label>
        <p role="status">{status ? `Left arm: ${status.left.reachable ? "reachable" : "UNREACHABLE"}; right arm: ${status.right.reachable ? "reachable" : "UNREACHABLE"}` : "Preparing rig…"}</p>
        <button onClick={exportConfig}>Export configuration</button>
        {proportionError && <p role="alert">{proportionError}</p>}
        <details open><summary>Body proportions</summary>{proportionControls.map(({ key, min, max }) => <Slider key={key} label={labelText(key)} value={config.proportions[key]} min={min} max={max} onChange={(value) => changeProportions(key, value)} />)}</details>
        <details><summary>Pose and movement</summary>
          <VectorControls label="Torso" value={config.pose.torsoPosition} onChange={(torsoPosition) => changePose({ torsoPosition })} />
          {(["left", "right"] as const).map((side) => <div key={side}>
            <VectorControls label={`${side} grip`} value={config.pose[side].position} onChange={(position) => changePose({ [side]: { ...config.pose[side], position } })} />
            <VectorControls label={`${side} elbow direction`} value={config.pose[side].elbowDirection} onChange={(elbowDirection) => changePose({ [side]: { ...config.pose[side], elbowDirection } })} />
          </div>)}
          {(["torsoRoll", "headRoll", "headYaw", "yawRange"] as const).map((key) => <Slider key={key} label={`${labelText(key)} radians`} value={config.pose[key]} min={key === "yawRange" ? 0 : -1.2} max={1.2} onChange={(value) => changePose({ [key]: value })} />)}
          <Slider label="Cycle seconds" value={config.pose.cycleSeconds} min={1} max={12} onChange={(cycleSeconds) => changePose({ cycleSeconds })} />
        </details>
        <details><summary>Materials</summary>{(["skin", "shirt"] as const).map((key) => <label key={key} style={{ display: "block" }}>{key} <input aria-label={`${key} color`} type="color" value={config.appearance[key]} onChange={(event) => setConfig((current) => ({ ...current, appearance: { ...current.appearance, [key]: event.target.value } }))} /></label>)}</details>
        <details><summary>Reference overlay</summary>
          <input aria-label="Reference image" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setReference(URL.createObjectURL(file)); }} />
          <p>Scale the reference until its head matches the 150px detail head, then align its edge with the red boundary.</p>
          <Slider label="Reference width" value={referenceWidth} min={100} max={1000} onChange={setReferenceWidth} />
          <Slider label="Reference x" value={referenceX} min={-500} max={500} onChange={setReferenceX} />
          <Slider label="Reference y" value={referenceY} min={-500} max={500} onChange={setReferenceY} />
          <Slider label="Reference opacity" value={opacity} min={0} max={1} onChange={setOpacity} />
        </details>
      </aside>
      <section><h2>Detail</h2><div style={{ position: "relative", overflow: "hidden", width: 442, height: 560 }}>
        <RigPreview config={config} mode={mode} debug={debug} onStatus={setStatus} />
        {reference && <img alt="Pose reference overlay" src={reference} style={{ position: "absolute", width: referenceWidth, maxWidth: "none", left: referenceX, top: referenceY, opacity, pointerEvents: "none" }} />}
      </div></section>
      <section><h2>Delivery size · 48px head</h2><RigPreview config={config} mode={mode} debug={debug} native /><p>Neutral head only. Character likeness approval comes after body approval.</p></section>
    </div>
    {exported && <details open><summary>Exported configuration</summary><textarea aria-label="Exported configuration" readOnly value={exported} style={{ width: "100%", height: 200 }} /></details>}
  </main>;
}
