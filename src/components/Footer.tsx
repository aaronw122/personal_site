import { useEffect, useState } from "react";

export default function Footer() {
  const [year, setYear] = useState(__BUILD_YEAR__);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="site-footer">
      <p className="site-footer-copyright">&copy; {year} aaron williams</p>
      <div className="site-footer-links">
        <a href="https://x.com/aaaronwill">twitter</a>
        <a href="https://github.com/aaronw122">github</a>
        <a href="https://www.linkedin.com/in/aaron-williams-91429a1a6/">linkedin</a>
      </div>
    </footer>
  );
}
