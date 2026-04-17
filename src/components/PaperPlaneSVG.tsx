import React from "react";

type PaperPlaneSVGProps = React.SVGProps<SVGSVGElement>;

/**
 * A hand-drawn style 2D paper airplane silhouette.
 * Filled with the notebook paper color and includes subtle fold lines.
 */
const PaperPlaneSVG: React.FC<PaperPlaneSVGProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 20"
    fill="none"
    {...props}
  >
    {/* Main airplane silhouette */}
    <path
      d="M2 10 L38 2 L28 10 L38 18 Z"
      fill="var(--color-paper, #faf6f0)"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    {/* Center fold line — the main crease */}
    <line
      x1="2"
      y1="10"
      x2="38"
      y2="10"
      stroke="currentColor"
      strokeWidth="0.4"
      strokeOpacity="0.25"
    />
    {/* Upper wing fold */}
    <line
      x1="8"
      y1="8"
      x2="34"
      y2="4"
      stroke="currentColor"
      strokeWidth="0.3"
      strokeOpacity="0.15"
    />
    {/* Lower wing fold */}
    <line
      x1="8"
      y1="12"
      x2="34"
      y2="16"
      stroke="currentColor"
      strokeWidth="0.3"
      strokeOpacity="0.15"
    />
  </svg>
);

export default PaperPlaneSVG;
