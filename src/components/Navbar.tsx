import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" aria-label="home">
        <SiteLogo />
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/about" className="navbar-link">
          about
        </NavLink>
        <NavLink to="/experience" className="navbar-link">
          experience
        </NavLink>
        <NavLink to="/writing" className="navbar-link">
          writing
        </NavLink>
        <NavLink to="/lists" className="navbar-link">
          lists
        </NavLink>
      </div>
    </nav>
  );
}

function SiteLogo() {
  return (
    <img
      src="/images/upside_down_transparent.png"
      alt="site logo"
      width="36"
      height="36"
    />
  );
}
