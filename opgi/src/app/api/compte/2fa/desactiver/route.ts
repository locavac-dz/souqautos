import { getServices } from "@/lib/services";
import { handle2faDesactiver } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle2faDesactiver(request, getServices());
}
