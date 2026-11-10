import { flushSync } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { PEEK_BOTTOM, STAGE_WIDTH } from "./stageLayout";
import PeekSprite, { type PeekPose } from "./PeekSprite";
import type { StageEngine, StageSnapshot, StageState } from "./runtime";

const desktopQuery =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const coarsePointerQuery = "(hover: none), (pointer: coarse)";
const reducedQuery = "(prefers-reduced-motion: reduce)";

export default function AvatarStage({ demo = false }: { demo?: boolean }) {
  const [desktop, setDesktop] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [controlsFocused, setControlsFocused] = useState(false);
  const [closeVisible, setCloseVisible] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [stageError, setStageError] = useState(false);
  const [snapshot, setSnapshot] = useState<StageSnapshot>({
    state: "peek",
    id: "bob",
    bpm: 0,
    distance: [0, 0],
    frameMs: 0,
    ready: false,
    trackTitle: "",
    trackIndex: 0,
    trackCount: 0,
    paused: true,
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<StageEngine | null>(null);
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const loading = useRef<Promise<StageEngine> | null>(null);
  const activation = useRef(false);
  const unmounted = useRef(false);
  const lifecycle = useRef(0);
  const peekPose = useRef<PeekPose>({ angle: 0, rise: 0 });
  const closeHideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const media = matchMedia(desktopQuery);
    const coarse = matchMedia(coarsePointerQuery);
    const motion = matchMedia(reducedQuery);
    const update = () => {
      setDesktop(media.matches);
      setCoarsePointer(coarse.matches);
      setReduced(motion.matches);
    };
    update();
    media.addEventListener("change", update);
    coarse.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const generation = ++lifecycle.current;
    unmounted.current = false;
    return () => {
      clearTimeout(closeHideTimer.current);
      if (lifecycle.current === generation) lifecycle.current++;
      unmounted.current = true;
      engine.current?.dispose();
      engine.current = null;
      loading.current = null;
    };
  }, []);

  const warm = useCallback(() => {
    if (loading.current) return loading.current;
    if (engine.current) return Promise.resolve(engine.current);
    const generation = lifecycle.current;
    loading.current = (async () => {
      const { StageEngine } = await import("./runtime");
      if (
        unmounted.current ||
        lifecycle.current !== generation ||
        !canvas.current ||
        !host.current
      )
        throw new Error("Stage unavailable during load");
      const instance = new StageEngine(
        canvas.current,
        host.current,
        setSnapshot,
        demoRef.current,
        reducedRef.current,
      );
      engine.current = instance;
      if (demoRef.current)
        instance.setDemoCamera(
          Number(new URLSearchParams(location.search).get("cam")) || 0,
        );
      await instance.init("bob");
      if (unmounted.current || lifecycle.current !== generation) {
        instance.dispose();
        throw new Error("Stage unavailable during load");
      }
      await instance.prepareTracks();
      if (unmounted.current || lifecycle.current !== generation) {
        instance.dispose();
        throw new Error("Stage unavailable during load");
      }
      instance.setReduced(reducedRef.current);
      instance.setDemoMode(demoRef.current);
      if (demoRef.current)
        instance.setDemoCamera(
          Number(new URLSearchParams(location.search).get("cam")) || 0,
        );
      setStageError(false);
      return instance;
    })();
    void loading.current.catch((error) => {
      if (lifecycle.current !== generation || unmounted.current) return;
      console.error("Avatar stage failed to load", error);
      setStageError(true);
      loading.current = null;
      if (engine.current) {
        engine.current.dispose();
        engine.current = null;
      }
    });
    return loading.current;
  }, []);

  useEffect(() => {
    const instance = engine.current;
    if (!instance) return;
    instance.setDemoMode(demo);
    if (demo)
      instance.setDemoCamera(
        Number(new URLSearchParams(location.search).get("cam")) || 0,
      );
  }, [demo]);

  useEffect(() => {
    const instance = engine.current;
    if (!instance) return;
    instance.setReduced(reduced);
  }, [reduced]);
  useEffect(() => {
    if (desktop) return;
    lifecycle.current++;
    activation.current = false;
    loading.current = null;
    engine.current?.dispose();
    engine.current = null;
    setPlaying(false);
    setStageReady(false);
    setControlsVisible(false);
    setControlsFocused(false);
    clearTimeout(closeHideTimer.current);
    setCloseVisible(false);
    setHovered(false);
    peekPose.current = { angle: 0, rise: 0 };
    setStageError(false);
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    const generation = lifecycle.current;
    let idle = 0;
    let fallback = 0;
    let revealTimer = 0;
    let cancelled = false;
    let reveal!: () => void;
    const revealAfterLoad = new Promise<void>((resolve) => {
      reveal = resolve;
    });
    const afterLoad = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;
      const loadedAt = navigation?.loadEventEnd || performance.now();
      const remaining = Math.max(0, 2000 - (performance.now() - loadedAt));
      revealTimer = window.setTimeout(reveal, remaining);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    const prepare = () => {
      void Promise.all([warm(), revealAfterLoad])
        .then(() => {
          if (!cancelled && lifecycle.current === generation)
            setStageReady(true);
        })
        .catch(() => undefined);
    };
    const schedule = () => {
      if (window.requestIdleCallback)
        idle = window.requestIdleCallback(prepare, { timeout: 5000 });
      else fallback = window.setTimeout(prepare, 200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", afterLoad);
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idle);
      clearTimeout(fallback);
      clearTimeout(revealTimer);
    };
  }, [desktop, warm]);

  const retry = () => {
    const generation = lifecycle.current;
    setStageError(false);
    setStageReady(false);
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const loadedAt = navigation?.loadEventEnd || performance.now();
    const remaining = Math.max(0, 2000 - (performance.now() - loadedAt));
    const revealAfterLoad = new Promise<void>((resolve) =>
      window.setTimeout(resolve, remaining),
    );
    void Promise.all([warm(), revealAfterLoad])
      .then(() => {
        if (!unmounted.current && desktop && lifecycle.current === generation)
          setStageReady(true);
      })
      .catch(() => undefined);
  };

  const activate = async (nextState: "hop" | "strum" = "hop") => {
    if (activation.current || playing) return;
    const generation = lifecycle.current;
    activation.current = true;
    try {
      const instance = await warm();
      if (unmounted.current || lifecycle.current !== generation) return;
      instance.startHop(() => {
        if (unmounted.current || lifecycle.current !== generation) return;
        flushSync(() => {
          setHovered(false);
          setPlaying(true);
        });
        if (nextState === "strum") instance.jump("strum");
      }, peekPose.current);
    } catch (error) {
      if (!unmounted.current && lifecycle.current === generation)
        console.error("Avatar stage failed to activate", error);
    } finally {
      activation.current = false;
    }
  };
  const toSprite = () => {
    activation.current = false;
    setPlaying(false);
    engine.current?.showSprite(true);
  };
  const exit = () => {
    clearTimeout(closeHideTimer.current);
    setCloseVisible(false);
    setControlsVisible(false);
    setControlsFocused(false);
    if (engine.current) engine.current.exit(toSprite);
    else toSprite();
  };
  const showClose = () => {
    clearTimeout(closeHideTimer.current);
    setCloseVisible(true);
  };
  const hideCloseLater = () => {
    clearTimeout(closeHideTimer.current);
    closeHideTimer.current = window.setTimeout(
      () => setCloseVisible(false),
      1000,
    );
  };

  if (!desktop) return null;
  return (
    <>
      {stageError && (
        <button
          type="button"
          onClick={retry}
          aria-label="Retry loading Bob"
          style={{
            position: "fixed",
            right: STAGE_WIDTH,
            bottom: 12,
            zIndex: 81,
            border: "1px solid #33465555",
            borderRadius: 14,
            padding: "5px 9px",
            color: "#334655",
            background: "#f3f5f1",
            boxShadow: "0 2px 8px #2233441a",
            font: "600 12px/1 system-ui",
            cursor: "pointer",
          }}
        >
          Retry Bob
        </button>
      )}
      {stageReady && !playing && (
        <PeekSprite
          avatarId="bob"
          reduced={reduced}
          hovered={hovered}
          pose={peekPose}
          onActivate={() => activate()}
          onHover={(active) => {
            setHovered(active);
          }}
        />
      )}
      <div
        ref={host}
        data-testid="stage-root"
        onFocusCapture={(event) => {
          if (event.target.matches(":focus-visible")) setControlsFocused(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setControlsFocused(false);
        }}
        style={{
          position: "fixed",
          right: 0,
          bottom: 0,
          width: STAGE_WIDTH,
          height: `calc(${PEEK_BOTTOM} + 520px)`,
          zIndex: 80,
          overflow: "hidden",
          pointerEvents: "none",
          opacity: playing ? 1 : 0,
        }}
      >
        <canvas
          ref={canvas}
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
          }}
        />
        {playing && snapshot.state === "strum" && !snapshot.exiting && (
          <>
            <button
              data-testid="stage-close"
              type="button"
              onClick={exit}
              onPointerEnter={showClose}
              onPointerLeave={hideCloseLater}
              aria-label="Return Bob to peeking"
              style={{
                ...controlButtonStyle,
                position: "absolute",
                left: 8,
                bottom: 270,
                zIndex: 1,
                opacity:
                  coarsePointer || closeVisible || controlsFocused ? 1 : 0,
                transition: reduced ? undefined : "opacity 360ms ease-in-out",
                pointerEvents:
                  coarsePointer || closeVisible || controlsFocused
                    ? "auto"
                    : "none",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div
              onPointerEnter={() => {
                setControlsVisible(true);
                showClose();
              }}
              onPointerLeave={() => {
                setControlsVisible(false);
                hideCloseLater();
              }}
              onPointerDown={() => {
                setControlsVisible(true);
                showClose();
              }}
              style={{
                position: "absolute",
                left: 15,
                right: 15,
                bottom: 0,
                height: 270,
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 118,
                  transform: `translate(-50%, ${coarsePointer || controlsVisible || controlsFocused ? "0" : "5px"})`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  opacity:
                    coarsePointer || controlsVisible || controlsFocused ? 1 : 0,
                  transition: reduced
                    ? undefined
                    : "opacity 360ms ease-in-out, transform 360ms ease-in-out",
                  pointerEvents:
                    coarsePointer || controlsVisible || controlsFocused
                      ? "auto"
                      : "none",
                }}
              >
                <span
                  role="status"
                  aria-live="polite"
                  style={visuallyHiddenStyle}
                >
                  {snapshot.musicError
                    ? "Audio unavailable. Play to retry."
                    : ""}
                </span>
                <div
                  role="group"
                  aria-label={`Music controls for ${snapshot.trackTitle}, track ${snapshot.trackIndex + 1} of ${snapshot.trackCount}`}
                  style={{ position: "relative", display: "flex", gap: 20 }}
                >
                  <button
                    data-testid="stage-track-prev"
                    type="button"
                    onClick={() => engine.current?.previousTrack()}
                    aria-label={`Previous track from ${snapshot.trackTitle}`}
                    style={controlButtonStyle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M2 3h2v10H2zm11 0v10L5 8z" />
                    </svg>
                  </button>
                  <button
                    data-testid="stage-track-toggle"
                    type="button"
                    onClick={() => engine.current?.toggleMusic()}
                    aria-label={
                      snapshot.musicError
                        ? `Retry ${snapshot.trackTitle}`
                        : `${snapshot.paused ? "Play" : "Pause"} ${snapshot.trackTitle}`
                    }
                    style={controlButtonStyle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      {snapshot.paused ? (
                        <path fill="currentColor" d="M4 2v12l10-6z" />
                      ) : (
                        <path
                          fill="currentColor"
                          d="M3 2h3v12H3zm7 0h3v12h-3z"
                        />
                      )}
                    </svg>
                  </button>
                  <button
                    data-testid="stage-track-next"
                    type="button"
                    onClick={() => engine.current?.nextTrack()}
                    aria-label={`Next track after ${snapshot.trackTitle}`}
                    style={controlButtonStyle}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 3h2v10h-2zM3 3l8 5-8 5z"
                      />
                    </svg>
                  </button>
                  {snapshot.musicError && (
                    <span
                      aria-hidden="true"
                      title="Audio unavailable. Play to retry."
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: -5,
                        marginLeft: 7,
                        width: 12,
                        height: 12,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        color: "#334655",
                        background: "#f3f5f1",
                        boxShadow: "0 0 0 1px #33465555",
                        fontSize: 9,
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      !
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {stageReady &&
        demo &&
        new URLSearchParams(location.search).has("debug") && (
          <aside
            style={{
              position: "fixed",
              top: 88,
              left: 28,
              zIndex: 81,
              background: "#f3f5f1",
              color: "#334655",
              border: "1px solid #d2d8d1",
              borderRadius: 12,
              padding: 16,
              width: 250,
              boxShadow: "0 8px 25px #2233441a",
              fontFamily: "system-ui",
            }}
          >
            <strong>Avatar stage</strong>
            <div data-testid="stage-state">
              {playing ? snapshot.state : "peek"}
            </div>
            <div>Avatar: bob</div>
            <div data-testid="stage-bpm">{snapshot.bpm} BPM</div>
            <div data-testid="stage-distance">
              Hands → grips:{" "}
              {snapshot.distance.map((v) => v.toFixed(3)).join(" / ")}
            </div>
            <div data-testid="stage-frame">
              Frame: {snapshot.frameMs.toFixed(1)} ms
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              Camera:{" "}
              <button
                data-testid="stage-cam-front"
                type="button"
                onClick={() => engine.current?.setDemoCamera(0)}
              >
                Front
              </button>
              <button
                data-testid="stage-cam-three-quarter"
                type="button"
                onClick={() => engine.current?.setDemoCamera(34)}
              >
                3/4
              </button>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
              {(["peek", "hop", "strum"] satisfies StageState[]).map(
                (state) => (
                  <button
                    type="button"
                    key={state}
                    data-testid={`stage-jump-${state}`}
                    onClick={() =>
                      state === "peek" ? toSprite() : void activate(state)
                    }
                  >
                    {state}
                  </button>
                ),
              )}
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              Scrub{" "}
              <input
                data-testid="stage-scrub"
                type="range"
                min="0"
                max="100"
                defaultValue="0"
                onChange={(event) =>
                  engine.current?.scrub(Number(event.target.value) / 100)
                }
              />
            </label>
            <button
              data-testid="stage-freeze-hop-start"
              type="button"
              onClick={() => engine.current?.freezeFirstHopFrame()}
            >
              Freeze hop t=0
            </button>
          </aside>
        )}
    </>
  );
}

const controlButtonStyle = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: "50%",
  color: "#fff",
  background: "rgba(0, 0, 0, 0.3)",
  cursor: "pointer",
} as const;

const visuallyHiddenStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
