import { getServices } from "@/lib/services";
import { handleImport } from "@/http/import";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleImport(request, getServices());
}
