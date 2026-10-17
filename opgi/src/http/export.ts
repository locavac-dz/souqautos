// Handler HTTP d'export CSV (Module A). GET /api/export?type=biens|contrats|impayes.
// Permission « exporter » (module A), isolé par organisme, et TRACÉ au journal
// d'audit (brief §9 : exports contrôlés et tracés).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { json } from "@/http/respond";
import { exportParType, type TypeExport } from "@/lib/modules/a/export";
import { recordAudit } from "@/lib/audit";

const TYPES: readonly TypeExport[] = ["biens", "contrats", "impayes"];

export async function handleExport(request: Request, s: Services): Promise<Response> {
  const type = new URL(request.url).searchParams.get("type") as TypeExport | null;
  if (!type || !TYPES.includes(type)) {
    return json(400, { error: "Type d'export inconnu." });
  }

  const auth = await authorize(request, s, "A", "exporter");
  if (auth instanceof Response) return auth;

  const { filename, csv } = await withTenant(s.app, auth.ctx, async (tx) => {
    const r = await exportParType(tx, auth.ctx.organisationId, type);
    await recordAudit(tx, auth.ctx.organisationId, {
      utilisateurId: auth.session.utilisateurId,
      action: `export.${type}`,
      objetType: "Export",
      resume: type,
    });
    return r;
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
