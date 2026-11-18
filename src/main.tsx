import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App, { preloadRoute } from "./App";
import "./index.css";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
const preload = preloadRoute(window.location.pathname).catch(() => undefined);

if (root.hasChildNodes()) {
  void preload.then(() => hydrateRoot(root, app));
} else {
  createRoot(root).render(app);
}
