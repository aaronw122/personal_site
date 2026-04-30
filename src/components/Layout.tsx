import { Outlet } from "react-router-dom";
import BackgroundImage from "./BackgroundImage";
import GenerativeSwirls from "./GenerativeSwirls";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout() {
  return (
    <>
      <BackgroundImage />
      <GenerativeSwirls />
      <div className="layout-shell">
        <Navbar />
        <main className="layout-main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}
