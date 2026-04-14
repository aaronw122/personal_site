import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div>
      <h2>404</h2>
      <p>page not found.</p>
      <p>
        <Link to="/">go home</Link>
      </p>
    </div>
  );
}
