import { getServices } from "@/lib/services";
import { handleBiens } from "@/http/patrimoine";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleBiens(request, getServices());
}

export async function POST(request: Request): Promise<Response> {
  return handleBiens(request, getServices());
}
