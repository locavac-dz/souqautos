import { getServices } from "@/lib/services";
import { handleBatiment } from "@/http/batiments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleBatiment(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleBatiment(request, getServices(), (await params).id);
}
export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handleBatiment(request, getServices(), (await params).id);
}
