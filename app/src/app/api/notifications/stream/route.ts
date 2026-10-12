import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { subscribeToUserNotifications, type NotificationEvent } from "@/lib/realtime";
import { getUnreadCount } from "@/lib/notification-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-route";

const HEARTBEAT_MS = 25000;

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthenticated", { status: 401 });
  }

  if (!(await checkRateLimit(`notifications:stream:${user.id}`, { limit: 10, windowMs: 60 * 1000 }))) {
    return new Response("rate_limited", { status: 429 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const initialCount = await getUnreadCount(user.id);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", count: initialCount })}\n\n`));

      const send = (event: NotificationEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      unsubscribe = subscribeToUserNotifications(user.id, send);

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
