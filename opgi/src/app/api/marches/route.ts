import { getServices } from "@/lib/services";
import { handleMarches } from "@/http/marches";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleMarches(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleMarches(request, getServices());
}
