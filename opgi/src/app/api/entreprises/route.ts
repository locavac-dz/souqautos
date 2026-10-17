import { getServices } from "@/lib/services";
import { handleEntreprises } from "@/http/entreprises";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleEntreprises(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleEntreprises(request, getServices());
}
