import { FEATURED_PROJECTS } from "../data/projects";
import ProjectCard from "./ProjectCard";
import SeeMoreCard from "./SeeMoreCard";

export default function ProjectShowcase() {
  return (
    <section className="mt-10">
      <h3 className="text-lg font-bold mb-4">what i've built</h3>

      <div className="relative">
        <div
          className="flex gap-4 overflow-x-auto snap-x pb-4 hide-scrollbar max-[480px]:-mx-6 max-[480px]:pl-6 max-[480px]:scroll-pl-6"
        >
          {FEATURED_PROJECTS.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
          <SeeMoreCard />
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent hidden min-[481px]:block" />
      </div>
    </section>
  );
}
