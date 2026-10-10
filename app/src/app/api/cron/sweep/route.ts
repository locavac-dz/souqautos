import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";
import { sweepOldNotifications } from "@/lib/notification-sweep";
import { sweepOldLoginEvents } from "@/lib/login-event-sweep";
import { sweepPendingChargilyOrders } from "@/lib/chargily-events";
import { sweepPendingTransferReminders, sweepSubscriptionExpiryReminders } from "@/lib/commercial-reminders";
import { sendWeeklyReportIfDue } from "@/lib/weekly-report";
import { safeEqual } from "@/lib/google-oauth";

// Called nightly by cron (see ops/crontab.example).
// Runs the three sweepers directly — bypasses throttledSweep which is designed
// for lazy page-visit calls, not scheduled execution.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 500 });
  }

  // Lot 267 (audit F2) — comparaison à temps constant, comme pour les autres secrets (google-oauth, chargily).
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const now = new Date();
  await sweepAutoRenewals(now);
  await sweepExpiringListingsForReminders(now);
  await sweepExpiredListings(now);
  await sweepOldNotifications(now);
  await sweepOldLoginEvents(now);
  // Lot 266 — commandes Chargily restées EN_ATTENTE (webhook perdu) : relues chez le prestataire.
  const pendingPayments = await sweepPendingChargilyOrders(now);
  // Lot 274 — relances commerciales : virements attendus (J+2) et abonnements pro qui expirent (15 j / 3 j).
  const transferReminders = await sweepPendingTransferReminders(now);
  const subscriptionReminders = await sweepSubscriptionExpiryReminders(now);
  // Lot 275 — rapport hebdomadaire à l'équipe, une fois par semaine complète (part donc le lundi).
  const weeklyReport = await sendWeeklyReportIfDue(now);

  return NextResponse.json({ ok: true, sweptAt: now.toISOString(), pendingPayments, transferReminders, subscriptionReminders, weeklyReport });
}
