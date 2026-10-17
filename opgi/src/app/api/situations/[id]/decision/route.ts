import { getServices } from "@/lib/services";
import { handleSituationDecision } from "@/http/marches";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleSituationDecision(request, getServices(), (await params).id);
}
