import { getServices } from "@/lib/services";
import { handlePieces } from "@/http/pieces";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handlePieces(request, getServices(), (await params).id);
}
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handlePieces(request, getServices(), (await params).id);
}
