import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { improveListingText } from "@/lib/ai-listing";
import { z } from "zod";

const improveSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  mileage: z.number().int().min(0).optional(),
  condition: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`listing-improve:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = improveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const improved = await improveListingText(parsed.data);
  if (!improved) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  return NextResponse.json(improved);
}
