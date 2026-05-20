import { useState } from "react";
import Lightbox from "./Lightbox";

export default function HeroBio() {
  const [lightbox, setLightbox] = useState(false);

  return (
    <section>
      <div className="hero-header">
        <h2 className="hero-name">aaron williams</h2>
        <h5 className="hero-location">new york, ny</h5>
      </div>

      <div className="hero-content">
        <div className="prose hero-bio">
          <p className="hero-bio-text">
            hey! i'm aaron. aspiring renaissance man. engineer currently building at fractal nyc.
          </p>
          <p className="hero-bio-text">
            i spent two years as a PM at expedia building products that drove $7M in annual profit. switched to engineering because i wanted to build things instead. check out my projects below.
          </p>
        </div>

        <div className="hero-photo-wrapper">
          <img
            src="/images/Platform_9_34_cropped.png"
            alt="photo of aaron"
            className="hero-photo"
            tabIndex={0}
            role="button"
            aria-label="View full size photo"
            onClick={() => setLightbox(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightbox(true);
              }
            }}
          />
        </div>
      </div>

      <Lightbox
        open={lightbox}
        onClose={() => setLightbox(false)}
        src="/images/Platform_9_34_cropped.png"
        alt="photo of aaron"
      />
    </section>
  );
}
