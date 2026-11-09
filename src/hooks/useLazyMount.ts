import { useEffect, type RefObject } from "react";

export default function useLazyMount(
  ref: RefObject<HTMLElement | null>,
  mount: (element: HTMLElement) => (() => void) | Promise<() => void>,
  deps: readonly unknown[],
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let idle: number | undefined;
    let timer: number | undefined;
    let loaded = document.readyState === "complete";
    let intersecting = false;

    const run = () => {
      if (disposed) return;
      const result = mount(element);
      if (!(result instanceof Promise)) {
        cleanup = result;
        return;
      }
      result.then((done) => {
        if (disposed) done();
        else cleanup = done;
      });
    };
    const schedule = () => {
      if (!loaded || !intersecting || disposed) return;
      observer.disconnect();
      if (window.requestIdleCallback) idle = window.requestIdleCallback(run);
      else timer = window.setTimeout(run, 0);
    };
    const onLoad = () => {
      loaded = true;
      schedule();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        intersecting = true;
        schedule();
      },
      { rootMargin: "600px 0px" },
    );
    if (!loaded) window.addEventListener("load", onLoad, { once: true });
    observer.observe(element);

    return () => {
      disposed = true;
      window.removeEventListener("load", onLoad);
      observer.disconnect();
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, deps);
}
