import { getServices } from "@/lib/services";
import { handleReclamations } from "@/http/reclamations";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleReclamations(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleReclamations(request, getServices());
}
