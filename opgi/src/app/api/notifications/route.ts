import { getServices } from "@/lib/services";
import { handleNotifications } from "@/http/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleNotifications(request, getServices());
}
