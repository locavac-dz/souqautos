// Handler HTTP d'import initial (Module A). Body JSON : { type, csv }.
import { z } from "zod";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { importBiens, importOccupants } from "@/lib/modules/a/import";
import { recordAudit } from "@/lib/audit";

const importSchema = z.object({
  type: z.enum(["biens", "occupants"]),
  csv: z.string().min(1).max(5_000_000),
});

export async function handleImport(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });

  // L'import crée des enregistrements du référentiel → permission « creer » (module A).
  const auth = await authorize(request, s, "A", "creer");
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, importSchema);
  if (body instanceof Response) return body;

  try {
    const rapport = await withTenant(s.app, auth.ctx, async (tx) => {
      const r =
        body.type === "biens"
          ? await importBiens(tx, auth.ctx.organisationId, body.csv)
          : await importOccupants(tx, auth.ctx.organisationId, body.csv);
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: `import.${body.type}`,
        objetType: body.type === "biens" ? "Bien" : "Occupant",
        resume: `${r.inseres} insérés, ${r.ignores} ignorés (sur ${r.total})`,
      });
      return r;
    });
    return json(200, { rapport });
  } catch (e) {
    return mapError(e);
  }
}
