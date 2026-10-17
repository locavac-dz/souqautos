import { getServices } from "@/lib/services";
import { handleOrdres } from "@/http/ordres";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleOrdres(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleOrdres(request, getServices());
}
