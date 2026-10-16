import { getServices } from "@/lib/services";
import { handleListBiens } from "@/http/biens";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleListBiens(request, getServices());
}
