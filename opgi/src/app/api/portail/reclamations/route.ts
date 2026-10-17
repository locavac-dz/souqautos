import { getServices } from "@/lib/services";
import { handleDepotPublic } from "@/http/portail";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleDepotPublic(request, getServices());
}
