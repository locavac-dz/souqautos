import { getServices } from "@/lib/services";
import { handleMarchePdf } from "@/http/marches";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleMarchePdf(request, getServices(), (await params).id);
}
