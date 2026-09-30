export default function Rick() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#000",
      }}
    >
      <img
        src="/rick.gif"
        alt="Rick Astley — Never Gonna Give You Up"
        style={{ width: "min(100vw, 133vh)" }}
      />
    </div>
  );
}
