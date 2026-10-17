import { getServices } from "@/lib/services";
import { handleImputations } from "@/http/finances";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleImputations(request, getServices());
}
