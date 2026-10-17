import { getServices } from "@/lib/services";
import { handleReclamationPdf } from "@/http/reclamations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleReclamationPdf(request, getServices(), (await params).id);
}
