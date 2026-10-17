import { getServices } from "@/lib/services";
import { handleContrats } from "@/http/contrats";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleContrats(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleContrats(request, getServices());
}
