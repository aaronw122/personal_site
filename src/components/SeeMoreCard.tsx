import { Link } from "react-router-dom";
import TornEdge, { useTornClip } from "./TornEdge";

export default function SeeMoreCard() {
  const clipStyle = useTornClip("see-more");
  return (
    <Link
      to="/experience#projects"
      className="see-more-card notebook-card"
      style={clipStyle}
    >
      <TornEdge seed="see-more" />
      <span className="see-more-label">see more &rarr;</span>
    </Link>
  );
}
