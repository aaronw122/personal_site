import { useRef, useCallback } from "react";
import usePageTitle from "../hooks/usePageTitle";

const EMAIL = "youfoundaaron@gmail.com";

export default function About() {
  usePageTitle("about");
  const btnRef = useRef<HTMLButtonElement>(null);

  const copyEmail = useCallback(() => {
    navigator.clipboard.writeText(EMAIL).then(() => {
      const btn = btnRef.current;
      if (!btn) return;
      btn.classList.add("copied");
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2000);
    });
  }, []);

  return (
    <div>
      <h2>about</h2>
      <div className="prose about-prose">
        <p>hey! i'm aaron.</p>
        <p>
          i grew up in chicago in a family of 5, and spent a ton of time with my nose in a book.
          so much so that i got a detention in the second grade for reading too much.
        </p>
        <p>
          at age 14, i started caddying at evanston golf club. through caddying, i got exposed to people
          from all different backgrounds, and learned that charisma beats smarts.
          i also received a full ride to the university of michigan as an evans scholar.
        </p>
        <p>
          in college, i worked on a tarpit idea to build an app to bridge the political divide.
          we pivoted to a newsletter, and failed miserably, but i learned a lot. mainly how to lead teams,
          and the magic of tech.
        </p>
        <p>
          i spent 2 years at expedia as a pm building products that drove $7m in annual profit.
          started teaching myself to program in the spring of 2025 because i wanted to build things!
        </p>
        <p>
          currently, i spend my time at fractal nyc working on a project that helps people polish their web design
          directly where its rendered - in the browser! i also like to meditate, meet new people, and catch live music when i can.
        </p>
        <p>
          i'd describe most of my friends as misfits. i'm drawn to people who
          are independent, curious, and have a thirst for adventure. if that
          sounds like you,{" "}
          <span className="email-tooltip-wrap">
            reach out
            <span className="email-tooltip">
              <span>{EMAIL}</span>
              <button
                ref={btnRef}
                className="email-tooltip-copy"
                onClick={copyEmail}
                aria-label="Copy email address"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
            </span>
          </span>
        </p>
      </div>
      <p className="about-quote">
        as a child i wanted to believe the magic in the books i read was real.
        its not, but turns out tech is a close second.
      </p>
    </div>
  );
}
