import { getServices } from "@/lib/services";
import { handleSite } from "@/http/sites";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleSite(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleSite(request, getServices(), (await params).id);
}
export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handleSite(request, getServices(), (await params).id);
}
