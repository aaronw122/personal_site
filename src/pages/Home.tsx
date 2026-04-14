import HeroBio from "../components/HeroBio";
import ProjectShowcase from "../components/ProjectShowcase";
import MagicQuote from "../components/MagicQuote";
import SocialLinks from "../components/SocialLinks";

export default function Home() {
  return (
    <div>
      <HeroBio />
      <ProjectShowcase />
      <MagicQuote />
      <SocialLinks />
    </div>
  );
}
