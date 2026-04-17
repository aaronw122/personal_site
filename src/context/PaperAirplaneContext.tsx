import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { Project } from "../data/projects";

type Phase = "idle" | "folding" | "flying" | "unfolding";

interface PaperAirplaneState {
  phase: Phase;
  originRect: DOMRect | null;
  destinationRect: DOMRect | null;
  url: string | null;
  project: Project | null;
}

interface PaperAirplaneContextValue extends PaperAirplaneState {
  triggerAnimation: (originRect: DOMRect, url: string, project: Project) => void;
  setDestinationRect: (rect: DOMRect) => void;
  setPhase: (phase: Phase) => void;
  reset: () => void;
}

const initialState: PaperAirplaneState = {
  phase: "idle",
  originRect: null,
  destinationRect: null,
  url: null,
  project: null,
};

const PaperAirplaneContext = createContext<PaperAirplaneContextValue | null>(null);

export function PaperAirplaneProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaperAirplaneState>(initialState);

  const triggerAnimation = useCallback(
    (originRect: DOMRect, url: string, project: Project) => {
      setState((prev) => {
        if (prev.phase !== "idle") return prev;
        return { ...prev, phase: "folding", originRect, url, project };
      });
    },
    [],
  );

  const setDestinationRect = useCallback((rect: DOMRect) => {
    setState((prev) => ({ ...prev, destinationRect: rect }));
  }, []);

  const setPhase = useCallback((phase: Phase) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <PaperAirplaneContext.Provider
      value={{ ...state, triggerAnimation, setDestinationRect, setPhase, reset }}
    >
      {children}
    </PaperAirplaneContext.Provider>
  );
}

export function usePaperAirplane(): PaperAirplaneContextValue {
  const ctx = useContext(PaperAirplaneContext);
  if (!ctx) {
    throw new Error("usePaperAirplane must be used within PaperAirplaneProvider");
  }
  return ctx;
}
