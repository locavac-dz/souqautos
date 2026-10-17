import { getServices } from "@/lib/services";
import { handleEtatComptePdf } from "@/http/finances";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleEtatComptePdf(request, getServices(), (await params).id);
}
