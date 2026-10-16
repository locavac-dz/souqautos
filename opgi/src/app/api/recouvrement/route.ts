import { getServices } from "@/lib/services";
import { handleActionsRecouvrement } from "@/http/finances";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleActionsRecouvrement(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleActionsRecouvrement(request, getServices());
}
