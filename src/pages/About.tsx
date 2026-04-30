import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";

export default function About() {
  usePageTitle("about");
  return (
    <div>
      <h2>about</h2>

      <div className="prose about-prose">
        <p>hey! i'm aaron.</p>
        <p>
          aspiring renaissance man. engineer currently building at fractal nyc.
        </p>
        <p>
          spent two years as a PM at expedia building products that drove $7M
          in annual profit. switched to engineering because i wanted to build
          things instead. check out my projects{" "}
          <Link to="/experience#projects" className="link-underline">here.</Link>
        </p>
        <p>
          i live for learning new things, the outdoors, meeting new people, and
          live music.
        </p>
        <p>
          i'd describe most of my friends as misfits. i'm drawn to people who
          are independent, curious, and have a thirst for adventure. if that
          sounds like you, reach out to{" "}
          <a href="mailto:youfoundaaron@gmail.com">
            <i>youfoundaaron@gmail.com</i>
          </a>
        </p>
      </div>

      <p className="about-quote">
        as a child i wanted to believe the magic in the books i read was real.
        its not, but turns out tech is a close second.
      </p>
    </div>
  );
}
