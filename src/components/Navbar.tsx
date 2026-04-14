import { NavLink } from "react-router-dom";

function SiteLogo() {
  return (
    <img
      src="/images/upside_down_transparent.png"
      alt="site logo"
      width="36"
      height="36"
      className=""
    />
  );
}

export default function Navbar() {
  return (
    <nav className="flex flex-row justify-between items-center w-full pt-[50px] max-[480px]:pt-[40px]">
      <NavLink to="/" aria-label="home">
        <SiteLogo />
      </NavLink>

      <div className="flex flex-row items-center gap-3 max-[480px]:gap-2">
        <NavLink
          to="/about"
          className="text-fg-1 no-underline px-3 py-2 max-[480px]:px-2"
        >
          about
        </NavLink>
        <NavLink
          to="/experience"
          className="text-fg-1 no-underline px-3 py-2 max-[480px]:px-2"
        >
          experience
        </NavLink>
        <NavLink
          to="/writing"
          className="text-fg-1 no-underline px-3 py-2 max-[480px]:px-2"
        >
          writing
        </NavLink>
        <NavLink
          to="/lists"
          className="text-fg-1 no-underline px-3 py-2 max-[480px]:px-2"
        >
          lists
        </NavLink>
      </div>
    </nav>
  );
}
