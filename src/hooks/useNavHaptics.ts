import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { WebHaptics } from "web-haptics";

// Minimal web haptics: a light tap on every in-app navigation.
// Uses web-haptics so it also fires on iOS Safari (hidden-switch trick),
// not just Android's navigator.vibrate. Skips the initial page load
// (that's not a navigation) and no-ops where unsupported.
let _haptics: WebHaptics | null = null;
function getHaptics(): WebHaptics | null {
  if (typeof window === "undefined") return null;
  if (!_haptics) {
    try {
      _haptics = new WebHaptics();
    } catch {
      _haptics = null;
    }
  }
  return _haptics;
}

export default function useNavHaptics() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  // prime the haptics engine (mounts the hidden iOS switch) on first mount
  useEffect(() => {
    getHaptics();
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      void getHaptics()?.trigger("light");
    } catch {
      /* haptics not available — silently skip */
    }
  }, [pathname]);
}
