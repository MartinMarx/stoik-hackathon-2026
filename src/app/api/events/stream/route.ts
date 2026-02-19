import { globalEmitter } from "@/lib/events/emitter";

const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET() {
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let onAnalysis: (payload: unknown) => void;
  let onVote: (payload: unknown) => void;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function push(event: string, data?: string) {
        const payload = data
          ? `event: ${event}\ndata: ${data}\n\n`
          : ": heartbeat\n\n";
        controller.enqueue(encoder.encode(payload));
      }

      onAnalysis = (payload: unknown) => {
        push("analysis", JSON.stringify(payload));
      };
      onVote = (payload: unknown) => {
        push("vote", JSON.stringify(payload));
      };

      globalEmitter.on("analysis", onAnalysis);
      globalEmitter.on("vote", onVote);

      heartbeatId = setInterval(() => {
        try {
          push("");
        } catch {
          if (heartbeatId) clearInterval(heartbeatId);
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      globalEmitter.off("analysis", onAnalysis);
      globalEmitter.off("vote", onVote);
      if (heartbeatId) clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
