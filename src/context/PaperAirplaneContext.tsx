import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { Project } from "../data/projects";

interface AirplaneState {
  phase: "idle" | "folding" | "looping" | "flying" | "landing";
  originRect: DOMRect | null;
  destinationRect: DOMRect | null;
  destinationUrl: string | null;
  project: Project | null;
}

interface PaperAirplaneContextValue extends AirplaneState {
  triggerAnimation: (
    originRect: DOMRect,
    url: string,
    project: Project
  ) => void;
  reportDestination: (rect: DOMRect) => void;
  setPhase: (phase: AirplaneState["phase"]) => void;
  reset: () => void;
}

const initialState: AirplaneState = {
  phase: "idle",
  originRect: null,
  destinationRect: null,
  destinationUrl: null,
  project: null,
};

const PaperAirplaneContext = createContext<PaperAirplaneContextValue | null>(
  null
);

export function PaperAirplaneProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AirplaneState>(initialState);

  const triggerAnimation = useCallback(
    (originRect: DOMRect, url: string, project: Project) => {
      setState((prev) => {
        if (prev.phase !== "idle") return prev;
        return {
          ...prev,
          phase: "folding",
          originRect,
          destinationUrl: url,
          project,
        };
      });
    },
    []
  );

  const reportDestination = useCallback((rect: DOMRect) => {
    setState((prev) => ({ ...prev, destinationRect: rect }));
  }, []);

  const setPhase = useCallback((phase: AirplaneState["phase"]) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <PaperAirplaneContext.Provider
      value={{
        ...state,
        triggerAnimation,
        reportDestination,
        setPhase,
        reset,
      }}
    >
      {children}
    </PaperAirplaneContext.Provider>
  );
}

export function usePaperAirplane(): PaperAirplaneContextValue {
  const context = useContext(PaperAirplaneContext);
  if (context === null) {
    throw new Error(
      "usePaperAirplane must be used within a PaperAirplaneProvider"
    );
  }
  return context;
}

export { PaperAirplaneContext };
