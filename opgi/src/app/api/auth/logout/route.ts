import { getServices } from "@/lib/services";
import { handleLogout } from "@/http/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleLogout(request, getServices());
}
