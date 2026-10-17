import { getServices } from "@/lib/services";
import { handleSites } from "@/http/sites";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleSites(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleSites(request, getServices());
}
