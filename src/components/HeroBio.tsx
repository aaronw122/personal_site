import { useState } from "react";
import Lightbox from "./Lightbox";

export default function HeroBio() {
  const [lightbox, setLightbox] = useState(false);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">aaron williams</h2>
        <h5 className="text-base font-light mt-0.5">new york, ny</h5>
      </div>

      <div className="flex flex-col min-[481px]:flex-row gap-3 items-start">
        <div className="prose flex-1">
          <p className="text-base leading-relaxed">
            hey! i'm aaron. aspiring renaissance man. engineer currently building at fractal nyc.
          </p>
          <p className="text-base leading-relaxed">
            i spent two years as a PM at expedia building products that drove $7M in annual profit. switched to engineering because i wanted to build things instead. check out my projects below.
          </p>
        </div>

        <div className="w-full min-[481px]:w-[200px] min-[481px]:min-w-[200px] pt-4.5 pr-3">
          <img
            src="/images/Platform_9_34_cropped.png"
            alt="photo of aaron"
            className="w-full max-w-[200px] mx-auto min-[481px]:mx-0 cursor-pointer"
            onClick={() => setLightbox(true)}
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
