import { Link } from "react-router-dom";
import type { Project } from "../data/projects";
import TornEdge, { useTornClip } from "./TornEdge";

interface ProjectCardProps {
  project: Project;
}

const cardClassName =
  "flex flex-col w-[320px] min-w-[320px] snap-start pl-11 pr-5 pt-5 pb-5 notebook-card transition-all duration-200 hover:-translate-y-0.5";

function CardContent({ project }: ProjectCardProps) {
  return (
    <>
      <TornEdge seed={project.name} />
      <h4 className="text-base !mt-0 leading-[23px]">{project.name}</h4>
      <p className="text-sm pt-[15px] leading-[23px] opacity-70 flex-1">
        {project.description}
      </p>
      <span className="text-sm pt-[23px] leading-[23px] underline underline-offset-2">
        {project.linkText}
      </span>
      <p className="text-xs leading-[23px] italic opacity-50">{project.stack}</p>
    </>
  );
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const href = project.blogUrl || project.url;
  const isInternal = href.startsWith("/");
  const clipStyle = useTornClip(project.name);

  if (isInternal) {
    return (
      <Link to={href} className={cardClassName} style={clipStyle}>
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
      style={clipStyle}
    >
      <CardContent project={project} />
    </a>
  );
}
