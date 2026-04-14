import { Outlet } from "react-router-dom";
import BackgroundImage from "./BackgroundImage";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout() {
  return (
    <>
      <BackgroundImage />
      <div className="flex flex-col items-stretch w-full max-w-[680px] mx-auto px-6 pb-[75px]">
        <Navbar />
        <main className="leading-[1.6] lowercase">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}
