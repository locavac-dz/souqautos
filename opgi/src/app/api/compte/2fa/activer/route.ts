import { getServices } from "@/lib/services";
import { handle2faActiver } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle2faActiver(request, getServices());
}
