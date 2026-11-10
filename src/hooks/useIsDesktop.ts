import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 900px)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches;
const getServerSnapshot = () => false;

export default function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
