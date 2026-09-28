import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";

// Called nightly by cron (see ops/crontab.example).
// Runs the three sweepers directly — bypasses throttledSweep which is designed
// for lazy page-visit calls, not scheduled execution.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  await sweepAutoRenewals(now);
  await sweepExpiringListingsForReminders(now);
  await sweepExpiredListings(now);

  return NextResponse.json({ ok: true, sweptAt: now.toISOString() });
}
