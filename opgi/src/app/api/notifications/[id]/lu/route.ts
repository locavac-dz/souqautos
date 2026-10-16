import { getServices } from "@/lib/services";
import { handleNotificationLue } from "@/http/notifications";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return handleNotificationLue(request, getServices(), (await params).id);
}
