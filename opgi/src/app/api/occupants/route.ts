import { getServices } from "@/lib/services";
import { handleOccupants } from "@/http/occupants";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleOccupants(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleOccupants(request, getServices());
}
