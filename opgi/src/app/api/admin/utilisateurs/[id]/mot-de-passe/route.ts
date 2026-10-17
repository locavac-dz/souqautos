import { getServices } from "@/lib/services";
import { handleAdminMotDePasse } from "@/http/admin-users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleAdminMotDePasse(request, getServices(), (await params).id);
}
