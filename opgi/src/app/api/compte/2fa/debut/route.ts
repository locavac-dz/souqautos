import { getServices } from "@/lib/services";
import { handle2faDebut } from "@/http/compte";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle2faDebut(request, getServices());
}
