import { Link } from "react-router-dom";
import type { Project } from "../data/projects";

interface ProjectCardProps {
  project: Project;
}

const cardClassName =
  "flex flex-col w-[280px] min-w-[280px] snap-start border border-black/15 rounded-md p-5 bg-black/[0.03] transition-colors duration-200 hover:bg-black/[0.06]";

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
