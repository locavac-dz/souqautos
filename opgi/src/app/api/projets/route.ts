import { getServices } from "@/lib/services";
import { handleProjets } from "@/http/projets";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleProjets(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleProjets(request, getServices());
}
