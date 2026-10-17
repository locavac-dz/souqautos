import { getServices } from "@/lib/services";
import { handleAdminUtilisateurs } from "@/http/admin-users";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAdminUtilisateurs(request, getServices());
}
export async function POST(request: Request): Promise<Response> {
  return handleAdminUtilisateurs(request, getServices());
}
