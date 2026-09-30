import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Project } from "../data/projects";
import TornEdge, { useTornClip } from "./TornEdge";

interface ProjectCardProps {
  project: Project;
}

interface SmartLinkProps {
  href: string;
  className: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children?: ReactNode;
}

const cardClassName = "notebook-card notebook-card-inner project-card";

function SmartLink({ href, className, style, ariaLabel, children }: SmartLinkProps) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} style={style} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

function CardContent({ project, labelHref }: ProjectCardProps & { labelHref?: string }) {
  return (
    <>
      <TornEdge seed={project.name} />
      <h4 className="project-card-title">{project.name}</h4>
      <p className="project-card-desc">{project.description}</p>
      {labelHref ? (
        <SmartLink href={labelHref} className="project-card-link project-card-link-inline">
          {project.linkText}
        </SmartLink>
      ) : (
        <span className="project-card-link">{project.linkText}</span>
      )}
      <p className="project-card-stack">{project.stack}</p>
    </>
  );
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const clipStyle = useTornClip(project.name);

  if (project.blogUrl) {
    return (
      <div className={cardClassName} style={clipStyle}>
        <SmartLink
          href={project.blogUrl}
          className="project-card-overlay"
          ariaLabel={project.name}
        />
        <CardContent project={project} labelHref={project.url} />
      </div>
    );
  }

  return (
    <SmartLink href={project.url} className={cardClassName} style={clipStyle}>
      <CardContent project={project} />
    </SmartLink>
  );
}
