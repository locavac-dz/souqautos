import { getServices } from "@/lib/services";
import { handleAppel } from "@/http/finances";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handleAppel(request, getServices(), (await params).id);
}
