import { getServices } from "@/lib/services";
import { handleReceptions } from "@/http/marches";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleReceptions(request, getServices(), (await params).id);
}
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleReceptions(request, getServices(), (await params).id);
}
