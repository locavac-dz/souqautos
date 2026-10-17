import { getServices } from "@/lib/services";
import { handlePaiements } from "@/http/finances";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handlePaiements(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handlePaiements(request, getServices());
}
