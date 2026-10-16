import { getServices } from "@/lib/services";
import { handlePieceTelechargement } from "@/http/pieces";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handlePieceTelechargement(request, getServices(), (await params).id);
}
