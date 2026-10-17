import { getServices } from "@/lib/services";
import { handleBatiments } from "@/http/batiments";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleBatiments(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleBatiments(request, getServices());
}
