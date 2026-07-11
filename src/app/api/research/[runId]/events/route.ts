import { getRun, subscribe } from "../../../../../server/pipeline/run";

export const dynamic = "force-dynamic";

/**
 * SSE stream of ProgressEvent. History replays on connect, then live events;
 * the stream closes after run_completed | run_failed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await ctx.params;
  if (!getRun(runId)) {
    return new Response(JSON.stringify({ error: "unknown run" }), { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        cleanup?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          close();
        }
      }, 15_000);

      cleanup = subscribe(runId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          close();
          return;
        }
        if (event.type === "run_completed" || event.type === "run_failed") close();
      });
    },
    cancel() {
      cleanup?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
