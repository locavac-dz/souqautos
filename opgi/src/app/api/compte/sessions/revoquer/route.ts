import { getServices } from "@/lib/services";
import { handleRevoquerSessions } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleRevoquerSessions(request, getServices());
}
