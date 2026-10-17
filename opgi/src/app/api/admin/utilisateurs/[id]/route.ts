import { getServices } from "@/lib/services";
import { handleAdminUtilisateur } from "@/http/admin-users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  return handleAdminUtilisateur(request, getServices(), (await params).id);
}
