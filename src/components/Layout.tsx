import { Suspense, useLayoutEffect } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import BackgroundImage from "./BackgroundImage";
import GenerativeSwirls from "./GenerativeSwirls";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType === "PUSH" && !hash) window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return (
    <>
      <BackgroundImage />
      <GenerativeSwirls />
      <div className="layout-shell">
        <Navbar />
        <main className="layout-main">
          <Suspense fallback={<div>loading...</div>}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}
