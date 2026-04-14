import { Link } from "react-router-dom";

export default function SeeMoreCard() {
  return (
    <Link
      to="/experience#projects"
      className="flex items-center justify-center w-[280px] min-w-[280px] snap-start
        rounded-xl border-2 border-dashed border-current/20 p-5
        transition-all duration-200 hover:border-current/40 hover:bg-white/5"
    >
      <span className="text-lg">see more &rarr;</span>
    </Link>
  );
}
