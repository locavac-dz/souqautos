import { getServices } from "@/lib/services";
import { handle2faStatut } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handle2faStatut(request, getServices());
}
