import { getServices } from "@/lib/services";
import { handleAudit } from "@/http/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAudit(request, getServices());
}
