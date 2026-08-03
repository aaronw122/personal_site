import { useEffect } from "react";
import { WebHaptics } from "web-haptics";

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
  useEffect(() => {
    const haptics = getHaptics();
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      if (!anchor.getAttribute("href")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      try {
        void haptics?.trigger("light");
      } catch {}
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
