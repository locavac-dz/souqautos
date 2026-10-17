import { getServices } from "@/lib/services";
import { handleEtatCompte } from "@/http/finances";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleEtatCompte(request, getServices(), (await params).id);
}
