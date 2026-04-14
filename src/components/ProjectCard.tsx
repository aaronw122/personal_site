import type { Project } from "../data/projects";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-[280px] min-w-[280px] snap-start rounded-xl bg-white/10 p-5
        transition-all duration-200 hover:bg-white/20 hover:scale-[1.02]"
    >
      <h4 className="font-bold text-lg mb-2">{project.name}</h4>
      <p className="text-sm leading-relaxed mb-3 opacity-85">
        {project.description}
      </p>
      <span className="text-sm underline underline-offset-2">
        {project.linkText}
      </span>
    </a>
  );
}
