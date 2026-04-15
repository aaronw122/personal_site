import { Link } from "react-router-dom";
import TornEdge, { useTornClip } from "./TornEdge";

const cardClassName =
  "flex items-center justify-center w-[320px] min-w-[320px] snap-start pl-11 pr-5 pt-5 pb-5 notebook-card transition-all duration-200 hover:-translate-y-0.5";

export default function SeeMoreCard() {
  const clipStyle = useTornClip("see-more");
  return (
    <Link
      to="/experience#projects"
      className={cardClassName}
      style={clipStyle}
    >
      <TornEdge seed="see-more" />
      <span className="text-lg">see more &rarr;</span>
    </Link>
  );
}
