import usePageTitle from "../hooks/usePageTitle";

export default function About() {
  usePageTitle("about");
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
          at age 14, i started caddying at evanston golf club. caddying had a big impact on me -
          it exposed me to people from all different backgrounds, and taught me that charisma beats smarts.
          i also got a full ride to the university of michigan as an evans scholar.
        </p>
        <p>
          in college, i worked on a tarpit idea to build an app to bridge the political divide.
          we pivoted to a newsletter, and failed miserably, but i learned a lot. mainly how to lead teams,
          and that i was interested in tech.
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
