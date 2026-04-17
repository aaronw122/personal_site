import { Outlet } from "react-router-dom";
import BackgroundImage from "./BackgroundImage";
import GenerativeSwirls from "./GenerativeSwirls";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { PaperAirplaneProvider } from "../context/PaperAirplaneContext";
import PaperAirplaneOverlay from "./PaperAirplaneOverlay";

export default function Layout() {
  return (
    <PaperAirplaneProvider>
      <BackgroundImage />
      <GenerativeSwirls />
      <div className="flex flex-col items-stretch w-full max-w-[680px] mx-auto px-6 pb-[75px]">
        <Navbar />
        <main className="leading-[1.6] lowercase">
          <Outlet />
        </main>
        <Footer />
      </div>
      <PaperAirplaneOverlay />
    </PaperAirplaneProvider>
  );
}
