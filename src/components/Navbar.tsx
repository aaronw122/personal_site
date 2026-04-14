import { NavLink } from "react-router-dom";

function TieDyeSwirl() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="tie-dye swirl logo"
    >
      <circle cx="18" cy="18" r="17" fill="#f0ebe4" />
      <path
        d="M18 4C12 4 8 8 8 13c0 4 3 6 6 7s5 3 5 6c0 2-1 4-3 5"
        stroke="#9b59b6"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 4c5 0 9 3 11 7s1 9-2 12-8 4-12 2"
        stroke="#3498db"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6 20c1 4 4 7 8 8s8-1 10-4"
        stroke="#e74c8b"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 8c-2 3-2 7 0 10s6 5 10 4"
        stroke="#f39c12"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 28c2-2 3-5 2-8s-4-5-7-5"
        stroke="#2ecc71"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Navbar() {
  return (
    <nav className="flex flex-row justify-between items-center w-full pt-[50px] max-[480px]:pt-[40px]">
      <NavLink to="/" aria-label="home">
        <TieDyeSwirl />
      </NavLink>

      <div className="flex flex-row items-center gap-3 max-[480px]:gap-2">
        <NavLink
          to="/about"
          className="text-[var(--color-fg-1)] no-underline px-3 py-2 max-[480px]:px-2"
        >
          about
        </NavLink>
        <NavLink
          to="/experience"
          className="text-[var(--color-fg-1)] no-underline px-3 py-2 max-[480px]:px-2"
        >
          experience
        </NavLink>
        <a
          href="/writing/"
          className="text-[var(--color-fg-1)] no-underline px-3 py-2 max-[480px]:px-2"
        >
          writing
        </a>
        <a
          href="/lists/"
          className="text-[var(--color-fg-1)] no-underline px-3 py-2 max-[480px]:px-2"
        >
          lists
        </a>
      </div>
    </nav>
  );
}
