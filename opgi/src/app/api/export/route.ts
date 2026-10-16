import { getServices } from "@/lib/services";
import { handleExport } from "@/http/export";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleExport(request, getServices());
}
