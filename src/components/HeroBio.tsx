import { Link } from "react-router-dom";

export default function HeroBio() {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">aaron williams</h2>
        <h5 className="text-base font-light mt-0.5">new york, ny</h5>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex-1">
          <p className="text-base leading-relaxed">
            hey, i'm aaron. pm turned engineer. i build things that help people
            connect, create, and learn.
          </p>
          <p className="mt-3">
            <Link to="/about" className="underline underline-offset-2">
              read more about me &rarr;
            </Link>
          </p>
        </div>

        <div className="w-full sm:w-[200px] sm:min-w-[200px]">
          <img
            src="/images/Platform_9_34_cropped.png"
            alt="photo of aaron"
            className="rounded-lg w-full max-w-[200px] mx-auto sm:mx-0"
          />
        </div>
      </div>
    </section>
  );
}
