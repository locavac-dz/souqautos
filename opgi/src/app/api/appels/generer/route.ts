import { getServices } from "@/lib/services";
import { handleAppelsGenerer } from "@/http/finances";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleAppelsGenerer(request, getServices());
}
