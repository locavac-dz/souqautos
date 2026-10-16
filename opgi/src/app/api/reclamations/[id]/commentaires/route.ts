import { getServices } from "@/lib/services";
import { handleCommentaires } from "@/http/reclamations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return handleCommentaires(request, getServices(), (await params).id);
}
export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleCommentaires(request, getServices(), (await params).id);
}
