import usePageTitle from "../hooks/usePageTitle";
import HeroBio from "../components/HeroBio";
import ProjectShowcase from "../components/ProjectShowcase";

export default function Home() {
  usePageTitle("home");
  return (
    <div>
      <HeroBio />
      <ProjectShowcase />
    </div>
  );
}
