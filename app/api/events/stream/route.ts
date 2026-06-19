import { NextRequest } from "next/server";
import { listLocalEvents, onLocalEvent } from "@/app/lib/local-event-store";
import type { PromptEvent } from "@/app/lib/prompt-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team") || "default";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const seen = new Set<string>();
      const send = (event: PromptEvent) => {
        if (event.team_id !== teamId) return;
        if (seen.has(event.id)) return;
        seen.add(event.id);
        controller.enqueue(encoder.encode(`event: prompt\ndata: ${JSON.stringify(event)}\n\n`));
      };

      const unsubscribe = onLocalEvent(send);
      const poll = setInterval(() => {
        listLocalEvents(teamId)
          .then((events) => {
            for (const event of events) send(event);
          })
          .catch(() => {});
      }, 500);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(poll);
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
