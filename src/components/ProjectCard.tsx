import { Link } from "react-router-dom";
import type { Project } from "../data/projects";

interface ProjectCardProps {
  project: Project;
}

const cardClassName =
  "flex flex-col w-[320px] min-w-[320px] snap-start pl-11 pr-5 pt-5 pb-5 notebook-card shadow-[2px_3px_8px_rgba(0,0,0,0.06)] transition-all duration-200 hover:shadow-[3px_5px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5";

function CardContent({ project }: ProjectCardProps) {
  return (
    <>
      <h4 className="text-base !mt-0 mb-2">{project.name}</h4>
      <p className="text-sm leading-relaxed mb-3 opacity-70 flex-1">
        {project.description}
      </p>
      <span className="text-sm underline underline-offset-2">
        {project.linkText}
      </span>
      <p className="text-xs italic opacity-50 mt-2 mb-0">{project.stack}</p>
    </>
  );
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const href = project.blogUrl || project.url;
  const isInternal = href.startsWith("/");

  if (isInternal) {
    return (
      <Link to={href} className={cardClassName}>
        <CardContent project={project} />
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClassName}
    >
      <CardContent project={project} />
    </a>
  );
}
