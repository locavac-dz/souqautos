import { NextResponse } from "next/server";
import { apiHandler, requireRole } from "@/lib/api-route";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { sendWeeklyReport } from "@/lib/weekly-report";

// Lot 275 — envoi à la demande du rapport de la dernière semaine complète (même contenu que l'envoi automatique
// du lundi), réservé aux ADMIN. Un rapport déjà envoyé est renvoyé (force) : c'est l'usage attendu du bouton.
export const POST = apiHandler(async () => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const result = await sendWeeklyReport(new Date(), { force: true });

  await writeAuditLog({
    adminId: user.id,
    action: "weekly_report.send",
    targetType: "WeeklyReport",
    targetId: result.periodStart,
    details: { status: result.status, recipients: result.status === "sent" ? result.recipients : 0 },
  });

  return NextResponse.json(result, { status: result.status === "no_recipients" ? 409 : 200 });
});
