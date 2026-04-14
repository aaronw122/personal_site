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
      className="flex flex-col w-[280px] min-w-[280px] snap-start border border-black/15 rounded-md p-5 bg-black/[0.03]
        transition-colors duration-200 hover:bg-black/[0.06]"
    >
      <h4 className="text-base !mt-0 mb-2">{project.name}</h4>
      <p className="text-sm leading-relaxed mb-3 opacity-70 flex-1">
        {project.description}
      </p>
      <span className="text-sm underline underline-offset-2">
        {project.linkText}
      </span>
      <p className="text-xs italic opacity-50 mt-2 mb-0">{project.stack}</p>
    </a>
  );
}
