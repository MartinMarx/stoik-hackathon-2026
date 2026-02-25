"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

const STREAM_URL = "/api/events/stream";

export const SUBSCRIBE_ANY_TEAM = "*";
const ANY_TEAM = SUBSCRIBE_ANY_TEAM;

export type AnalysisEventPayload = {
  type:
    | "analysis:queued"
    | "analysis:started"
    | "analysis:completed"
    | "analysis:failed";
  teamId: string;
  teamName: string;
  timestamp: string;
  data?: { totalScore?: number; previousScore?: number };
};

const refetchListeners = new Map<string, Set<() => void>>();

function getListeners(teamId: string): Set<() => void> {
  let set = refetchListeners.get(teamId);
  if (!set) {
    set = new Set();
    refetchListeners.set(teamId, set);
  }
  return set;
}

function notifyRefetch(teamId: string) {
  getListeners(teamId).forEach((cb) => cb());
  getListeners(ANY_TEAM).forEach((cb) => cb());
}

export function useAnalysisEvents() {
  const [analyzingTeams, setAnalyzingTeams] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  const subscribeRefetch = useCallback(
    (teamId: string | typeof ANY_TEAM, callback: () => void) => {
      const key = teamId;
      getListeners(key).add(callback);
      return () => {
        getListeners(key).delete(callback);
      };
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const es = new EventSource(STREAM_URL);
    eventSourceRef.current = es;

    es.addEventListener("analysis", (e: MessageEvent) => {
      let payload: AnalysisEventPayload;
      try {
        payload = JSON.parse(e.data as string) as AnalysisEventPayload;
      } catch {
        return;
      }

      const { type, teamId, teamName } = payload;

      if (type === "analysis:queued") {
        setAnalyzingTeams((prev) => new Set(prev).add(teamId));
        toast.loading(`Queued ${teamName} for analysis...`, { id: teamId });
        notifyRefetch(teamId);
        return;
      }

      if (type === "analysis:started") {
        setAnalyzingTeams((prev) => new Set(prev).add(teamId));
        toast.loading(`Analyzing ${teamName}...`, { id: teamId });
        return;
      }

      setAnalyzingTeams((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
      toast.dismiss(teamId);

      if (type === "analysis:completed") {
        toast.success(`${teamName} analysis complete`, { id: teamId });
        notifyRefetch(teamId);
      } else if (type === "analysis:failed") {
        toast.error(`${teamName} analysis failed`, { id: teamId });
        notifyRefetch(teamId);
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        if (!eventSourceRef.current) setAnalyzingTeams((prev) => new Set(prev));
      }, 2000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { analyzingTeams, subscribeRefetch };
}
