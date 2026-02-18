"use client";

import { createContext, useContext } from "react";
import { useAnalysisEvents } from "@/hooks/use-analysis-events";

const AnalysisContext = createContext<ReturnType<
  typeof useAnalysisEvents
> | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const value = useAnalysisEvents();
  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisEventsContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx)
    throw new Error(
      "useAnalysisEventsContext must be used within AnalysisProvider",
    );
  return ctx;
}
