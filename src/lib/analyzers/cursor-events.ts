import type { CursorMetricsData } from "@/types";

interface CursorEvent {
  timestamp?: string;
  ts?: string;
  event: string;
  source?: string;
  conversation_id?: string;
  generation_id?: string;
  model?: string;
  cursor_version?: string;
  user_email?: string;
  user?: string;
  team?: string;
  mode?: string | null;
  lang?: string | null;
  intent?: string | null;
  ctx?: number;
  data?: Record<string, unknown>;
}

function normalizeEvent(raw: CursorEvent): CursorEvent {
  const ts = raw.ts ?? raw.timestamp;
  const data = raw.data ?? {};
  return {
    ...raw,
    timestamp: ts,
    conversation_id: raw.conversation_id ?? (data.conversation_id as string),
    model: raw.model ?? (data.model as string),
    user_email: raw.user_email ?? raw.user,
  };
}

/**
 * Parse all lines from an events.jsonl string into an array of CursorEvent objects.
 * Supports both legacy (timestamp, conversation_id at top level) and per-user format
 * (ts, data.conversation_id). Skips empty lines and malformed JSON (logs a warning for each).
 */
function parseLines(eventsJsonl: string): CursorEvent[] {
  const lines = eventsJsonl.split("\n");
  const events: CursorEvent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line) as CursorEvent;
      events.push(normalizeEvent(parsed));
    } catch {
      console.warn(`[cursor-events] Skipping malformed JSON at line ${i + 1}`);
    }
  }

  return events;
}

/**
 * Parse Cursor IDE events from a JSONL string and compute aggregate metrics.
 */
export function parseCursorEvents(eventsJsonl: string): CursorMetricsData {
  const events = parseLines(eventsJsonl);

  let totalPrompts = 0;
  let totalToolUses = 0;
  const toolUseBreakdown: Record<string, number> = {};
  const conversationIds = new Set<string>();
  const models = new Set<string>();
  let agentThoughtsCount = 0;
  let fileEditsCount = 0;
  let shellExecutionsCount = 0;
  let mcpExecutionsCount = 0;
  let responseDurationSum = 0;
  let responseDurationCount = 0;
  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;

  for (const event of events) {
    // Track timestamps for first/last event
    if (event.timestamp) {
      if (firstEventAt === null || event.timestamp < firstEventAt) {
        firstEventAt = event.timestamp;
      }
      if (lastEventAt === null || event.timestamp > lastEventAt) {
        lastEventAt = event.timestamp;
      }
    }

    // Track conversation IDs
    if (event.conversation_id) {
      conversationIds.add(event.conversation_id);
    }

    // Track models (skip "default")
    if (event.model && event.model !== "default") {
      models.add(event.model);
    }

    switch (event.event) {
      case "beforeSubmitPrompt":
        totalPrompts++;
        break;

      case "preToolUse":
        totalToolUses++;
        if (event.data?.tool_name) {
          const toolName = String(event.data.tool_name);
          toolUseBreakdown[toolName] = (toolUseBreakdown[toolName] || 0) + 1;
        }
        break;

      case "afterAgentThought":
        agentThoughtsCount++;
        if (
          event.data?.duration_ms != null &&
          typeof event.data.duration_ms === "number"
        ) {
          responseDurationSum += event.data.duration_ms;
          responseDurationCount++;
        }
        break;

      case "afterFileEdit":
      case "afterTabFileEdit":
        fileEditsCount++;
        break;

      case "beforeShellExecution":
        shellExecutionsCount++;
        break;

      case "beforeMCPExecution":
        mcpExecutionsCount++;
        break;
    }
  }

  const avgResponseTimeMs =
    responseDurationCount > 0
      ? Math.round(responseDurationSum / responseDurationCount)
      : 0;

  return {
    totalPrompts,
    totalToolUses,
    toolUseBreakdown,
    totalSessions: conversationIds.size,
    modelsUsed: Array.from(models).sort(),
    agentThoughtsCount,
    fileEditsCount,
    shellExecutionsCount,
    mcpExecutionsCount,
    avgResponseTimeMs,
    totalEvents: events.length,
    firstEventAt,
    lastEventAt,
  };
}

/**
 * Get distribution of events across modes (agent, ask, plan, edit, debug).
 * Returns a record mapping each mode to the number of events with that mode.
 * Events with null/undefined mode are counted under "unknown".
 */
export function getModeDistribution(
  eventsJsonl: string,
): Record<string, number> {
  const events = parseLines(eventsJsonl);
  const distribution: Record<string, number> = {};

  for (const event of events) {
    const mode = event.mode ?? "unknown";
    distribution[mode] = (distribution[mode] || 0) + 1;
  }

  return distribution;
}

/**
 * Get distribution of detected intents across prompt events.
 * Returns a record mapping each intent to the number of beforeSubmitPrompt events
 * with that intent. Events with null/undefined intent are counted under "unknown".
 */
export function getIntentDistribution(
  eventsJsonl: string,
): Record<string, number> {
  const events = parseLines(eventsJsonl);
  const distribution: Record<string, number> = {};

  for (const event of events) {
    if (event.event !== "beforeSubmitPrompt") continue;
    const intent = event.intent ?? "unknown";
    distribution[intent] = (distribution[intent] || 0) + 1;
  }

  return distribution;
}

/**
 * Get activity timeline showing event counts per hour.
 * Returns a record mapping ISO hour strings (e.g. "2026-02-10T09") to the number
 * of events that occurred during that hour.
 */
export function getActivityTimeline(
  eventsJsonl: string,
): Record<string, number> {
  const events = parseLines(eventsJsonl);
  const timeline: Record<string, number> = {};

  for (const event of events) {
    if (!event.timestamp) continue;

    // Extract the hour portion: "2026-02-10T09:16:48Z" -> "2026-02-10T09"
    const hourKey = event.timestamp.slice(0, 13);
    timeline[hourKey] = (timeline[hourKey] || 0) + 1;
  }

  return timeline;
}
