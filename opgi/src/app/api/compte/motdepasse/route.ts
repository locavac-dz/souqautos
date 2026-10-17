import { getServices } from "@/lib/services";
import { handleChangePassword } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  return handleChangePassword(request, getServices());
}
