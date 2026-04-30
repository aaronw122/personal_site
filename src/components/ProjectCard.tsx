import { Link } from "react-router-dom";
import type { Project } from "../data/projects";
import TornEdge, { useTornClip } from "./TornEdge";

interface ProjectCardProps {
  project: Project;
}

const cardClassName =
  "notebook-card notebook-card-inner project-card";

function CardContent({ project }: ProjectCardProps) {
  return (
    <>
      <TornEdge seed={project.name} />
      <h4 className="project-card-title">{project.name}</h4>
      <p className="project-card-desc">
        {project.description}
      </p>
      <span className="project-card-link">
        {project.linkText}
      </span>
      <p className="project-card-stack">{project.stack}</p>
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
