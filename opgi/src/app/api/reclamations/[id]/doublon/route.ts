import { getServices } from "@/lib/services";
import { handleReclamationDoublon } from "@/http/reclamations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleReclamationDoublon(request, getServices(), (await params).id);
}
