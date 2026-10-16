import { getServices } from "@/lib/services";
import { handleEntreprise } from "@/http/entreprises";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleEntreprise(request, getServices(), (await params).id);
}
export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleEntreprise(request, getServices(), (await params).id);
}
export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  return handleEntreprise(request, getServices(), (await params).id);
}
