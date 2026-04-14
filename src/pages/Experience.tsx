import usePageTitle from "../hooks/usePageTitle";

export default function Experience() {
  usePageTitle("experience");
  return (
    <div>
      <h2>experience</h2>

      <h4>thera (2026)</h4>
      <p>
        two week internship. built a full-stack AI copilot for{" "}
        <a href="https://www.getthera.com/">Thera</a>, a global payroll
        platform. streaming SSE chat UI in Next.js. designed backend
        orchestration layer in Kotlin for sending messages, updating history, and
        determining which tools to call.
      </p>

      <h4>product at expedia (2023-25)</h4>
      <p>
        led a team of 8 developers, two machine learning engineers and one
        designer to help our travellers get better prices on hotels. contributed
        to 7M in annual GP.
      </p>

      <h4>nonpolar (2021-2022)</h4>
      <p>
        in the midst of jan 6th i grew frustrated by the political divide in the
        country. worked on a tarpit idea to build a news aggregation app to
        bridge the political divide. made lots of{" "}
        <a href="/writing/lessons%20from%20nonpolar/">mistakes</a> along the way.
      </p>

      <h3 id="projects">projects</h3>

      <h4>musicMixer</h4>
      <p>
        a web app that creates a music mashup. upload two songs, and the program
        takes vocals from one song, instrumentals from the other, and mixes them
        together. anyone can be a DJ! check it out{" "}
        <a href="https://mixer.awill.co">here.</a>
      </p>

      <h4>particleArt</h4>
      <p>
        a simple web app where you type in text, and it generates particle art
        using a{" "}
        <a href="/writing/fine%20tuning%20stable%20diffusion%20to%20create%20particle%20art/">
          model i fine tuned.
        </a>{" "}
        check it out <a href="https://prtkl.net">at prtkl.net</a>
      </p>

      <h4>multiDraw</h4>
      <p>
        i was frustrated with excalidraw only allowing one drawing so i built a
        multi-project version of it. save, organize, and switch between multiple
        drawings — all local-first in your browser. check it out{" "}
        <a href="https://multidraw.net">at multidraw.net</a>
      </p>

      <h4>diaHistory</h4>
      <p>
        a macOS CLI tool that automatically archives your Dia browser
        conversations as local markdown files.{" "}
        <a href="https://github.com/aaronw122/diaHistory">github.</a>
      </p>

      <h4>CTA widget tracker</h4>
      <p>
        every day i take the same bus to work, but i hate going through many
        clicks just to know what time it comes. i dreamed of having a widget on
        my home screen.{" "}
        <a href="https://testflight.apple.com/join/yW1pzgWA">
          so here it is.
        </a>
      </p>

      <h4>personal website</h4>
      <p>
        this website. built using html + vanilla js. deployed on my home server
        using cloudflare and docker.
      </p>

      <h4>twitter offline poster</h4>
      <p>
        wanted to post on twitter without logging in and seeing brainrot.
        vibecoded this tool in a day with codex(jun '25). damn near one shot it.{" "}
        <a href="https://easytweet.xyz">easytweet.xyz</a>
      </p>
    </div>
  );
}
