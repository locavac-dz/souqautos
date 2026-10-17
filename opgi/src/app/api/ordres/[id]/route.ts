import { getServices } from "@/lib/services";
import { handleOrdre } from "@/http/ordres";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleOrdre(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleOrdre(request, getServices(), (await params).id);
}
