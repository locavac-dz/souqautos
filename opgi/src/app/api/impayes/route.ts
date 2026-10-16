import { getServices } from "@/lib/services";
import { handleImpayes } from "@/http/finances";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleImpayes(request, getServices());
}
