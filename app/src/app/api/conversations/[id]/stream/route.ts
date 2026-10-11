import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { subscribeToConversation, type ConversationEvent } from "@/lib/realtime";
import { canAccessConversation } from "@/lib/listing-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-route";

const HEARTBEAT_MS = 25000;

export const GET = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthenticated", { status: 401 });
  }

  if (!(await checkRateLimit(`conversations:stream:${user.id}`, { limit: 30, windowMs: 60 * 1000 }))) {
    return new Response("rate_limited", { status: 429 });
  }

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation || !(await canAccessConversation(user.id, conversation))) {
    return new Response("not_found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ConversationEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      unsubscribe = subscribeToConversation(id, send);

      // Garde la connexion ouverte à travers les proxys qui coupent les
      // flux inactifs (Ethereal/Vercel-like), sans porter d'information.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
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
});
