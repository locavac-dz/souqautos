import { getServices } from "@/lib/services";
import { handleReclamation } from "@/http/reclamations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleReclamation(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleReclamation(request, getServices(), (await params).id);
}
