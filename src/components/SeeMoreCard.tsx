import { Link } from "react-router-dom";

const cardClassName =
  "flex items-center justify-center w-[320px] min-w-[320px] snap-start pl-11 pr-5 pt-5 pb-5 notebook-card shadow-[2px_3px_8px_rgba(0,0,0,0.06)] transition-all duration-200 hover:shadow-[3px_5px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5";

export default function SeeMoreCard() {
  return (
    <Link
      to="/experience#projects"
      className={cardClassName}
    >
      <span className="text-lg">see more &rarr;</span>
    </Link>
  );
}
