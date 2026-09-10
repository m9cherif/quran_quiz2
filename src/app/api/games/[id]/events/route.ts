import { subscribe, type RealtimeEvent } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One SSE stream per competition. Anyone can open this (host or a
 * participant) — it only ever carries state that's already visible to
 * whoever is looking at the game (question text once started, participant
 * lists, scores); it never carries answer keys or anything RLS used to gate
 * more tightly than that. Routes that need to gate WHAT gets sent still do
 * so themselves by only calling emit() with data appropriate for everyone
 * watching that competition.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = await params;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed (client disconnected mid-write).
        }
      };

      // A comment line keeps some proxies from buffering the response
      // indefinitely waiting for more bytes before the first flush.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe(competitionId, send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // @ts-expect-error — Next.js's Request in a route handler does carry signal.
      _request.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
