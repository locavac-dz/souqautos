import { getServices } from "@/lib/services";
import { handleLogin } from "@/http/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleLogin(request, getServices());
}
