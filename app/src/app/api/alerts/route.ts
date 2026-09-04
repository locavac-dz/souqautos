import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSearchAlertSchema,
  sanitizeAlertFilters,
  hasAtLeastOneFilter,
  MAX_ALERTS_PER_USER,
} from "@/lib/validation/search-alert";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`alert-create:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSearchAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const filters = sanitizeAlertFilters(parsed.data.filters);
  if (!hasAtLeastOneFilter(filters)) {
    return NextResponse.json({ error: "filters_required" }, { status: 400 });
  }

  const existingCount = await prisma.searchAlert.count({ where: { userId: user.id } });
  if (existingCount >= MAX_ALERTS_PER_USER) {
    return NextResponse.json({ error: "too_many_alerts" }, { status: 400 });
  }

  const alert = await prisma.searchAlert.create({
    data: { userId: user.id, label: parsed.data.label, filters: JSON.stringify(filters) },
  });

  return NextResponse.json({ id: alert.id }, { status: 201 });
}
