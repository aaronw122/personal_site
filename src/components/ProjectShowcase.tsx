import { FEATURED_PROJECTS } from "../data/projects";
import ProjectCard from "./ProjectCard";
import SeeMoreCard from "./SeeMoreCard";

export default function ProjectShowcase() {
  return (
    <section className="showcase-section">
      <h3 className="showcase-heading">what i've built</h3>

      <div className="showcase-wrapper">
        <div className="showcase-scroll hide-scrollbar">
          {FEATURED_PROJECTS.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
          <SeeMoreCard />
        </div>
        <div className="showcase-fade" />
      </div>
    </section>
  );
}
