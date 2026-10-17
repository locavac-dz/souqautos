import { getServices } from "@/lib/services";
import { handleOrdrePdf } from "@/http/ordres";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleOrdrePdf(request, getServices(), (await params).id);
}
