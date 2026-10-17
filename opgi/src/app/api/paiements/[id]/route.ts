import { getServices } from "@/lib/services";
import { handlePaiement } from "@/http/finances";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handlePaiement(request, getServices(), (await params).id);
}
