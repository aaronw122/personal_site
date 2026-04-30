import usePageTitle from "../hooks/usePageTitle";
import { Link } from "react-router-dom";

function Entry({ title, date, children }: { title: string; date: string; children: React.ReactNode }) {
  return (
    <div className="exp-entry">
      <div className="exp-entry-header">
        <h4 className="exp-entry-title">{title}</h4>
        <span className="exp-entry-date">{date}</span>
      </div>
      <p className="exp-entry-body">{children}</p>
    </div>
  );
}

export default function Experience() {
  usePageTitle("experience");
  return (
    <div>
      <h2>experience</h2>

      <div>
        <Entry title="full stack engineer at thera" date="2026">
          built a full-stack AI copilot for{" "}
          <a href="https://www.getthera.com/" className="link-underline">Thera</a>, a global payroll
          platform. streaming SSE chat UI in Next.js. designed backend
          orchestration layer in Kotlin for sending messages, updating history, and
          determining which tools to call.
        </Entry>

        <Entry title="product at expedia" date="2023–2025">
          led a team of 8 developers, two machine learning engineers and one
          designer to help our travellers get better prices on hotels. contributed
          to 7M in annual GP.
        </Entry>

        <Entry title="nonpolar" date="2021–2022">
          in the midst of jan 6th i grew frustrated by the political divide in the
          country. worked on a tarpit idea to build a news aggregation app to
          bridge the political divide. made lots of{" "}
          <Link to="/writing/lessons%20from%20nonpolar" className="link-underline">mistakes</Link> along the way.
        </Entry>
      </div>

      <h3 id="projects" className="exp-projects-heading">projects</h3>

      <div>
        <Entry title="musicMixer" date="2026">
          a web app that creates a music mashup. upload two songs, and the program
          takes vocals from one song, instrumentals from the other, and mixes them
          together. anyone can be a DJ! check it out{" "}
          <a href="https://mixer.awill.co" className="link-underline">here.</a>
        </Entry>

        <Entry title="particleArt" date="2026">
          a simple web app where you type in text, and it generates particle art
          using a{" "}
          <Link to="/writing/fine%20tuning%20stable%20diffusion%20to%20create%20particle%20art" className="link-underline">
            model i fine tuned.
          </Link>{" "}
          check it out <a href="https://prtkl.net" className="link-underline">at prtkl.net</a>
        </Entry>

        <Entry title="multiDraw" date="2026">
          i was frustrated with excalidraw only allowing one drawing so i built a
          multi-project version of it. save, organize, and switch between multiple
          drawings — all local-first in your browser. check it out{" "}
          <a href="https://multidraw.net" className="link-underline">at multidraw.net</a>
        </Entry>

        <Entry title="diaHistory" date="2026">
          a macOS CLI tool that automatically archives your Dia browser
          conversations as local markdown files.{" "}
          <a href="https://github.com/aaronw122/diaHistory" className="link-underline">github.</a>
        </Entry>

        <Entry title="CTA widget tracker" date="2025">
          every day i take the same bus to work, but i hate going through many
          clicks just to know what time it comes. i dreamed of having a widget on
          my home screen.{" "}
          <a href="https://testflight.apple.com/join/yW1pzgWA" className="link-underline">
            so here it is.
          </a>
        </Entry>

        <Entry title="twitter offline poster" date="2026">
          wanted to post on twitter without logging in and seeing brainrot.
          vibecoded this tool in a day with codex(jun '25). damn near one shot it.{" "}
          <a href="https://easytweet.xyz" className="link-underline">easytweet.xyz</a>
        </Entry>
      </div>
    </div>
  );
}
