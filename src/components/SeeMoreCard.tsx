import { Link } from "react-router-dom";

const cardClassName =
  "flex items-center justify-center w-[280px] min-w-[280px] snap-start border border-black/15 rounded-md p-5 bg-black/[0.03] transition-colors duration-200 hover:bg-black/[0.06]";

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
