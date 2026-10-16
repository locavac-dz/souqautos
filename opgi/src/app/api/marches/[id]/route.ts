import { getServices } from "@/lib/services";
import { handleMarche } from "@/http/marches";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleMarche(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleMarche(request, getServices(), (await params).id);
}
export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handleMarche(request, getServices(), (await params).id);
}
