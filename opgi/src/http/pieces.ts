// Handlers HTTP des pièces jointes (Module C) : upload (base64) et
// téléchargement médié. Contrôle du type MIME et de la taille à l'upload.
import { z } from "zod";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize, type AuthorizedContext } from "@/http/guard";
import { csrfGuard, parseBody } from "@/http/helpers";
import { json } from "@/http/respond";
import { nouvelleCle, putObject, getObject, removeObject } from "@/lib/storage/local";
import {
  creerPieceRow,
  listPieces,
  getPieceAutorisee,
  MIMES_AUTORISES,
  TAILLE_MAX_OCTETS,
} from "@/lib/modules/c/pieces";
import { recordAudit } from "@/lib/audit";
import type { Acteur } from "@/lib/modules/c/service";

const uploadSchema = z.object({
  nomFichier: z.string().trim().min(1).max(255),
  typeMime: z.string().trim().min(1).max(100),
  contenuBase64: z.string().min(1),
});

function acteurDe(auth: AuthorizedContext): Acteur {
  return { utilisateurId: auth.session.utilisateurId, role: auth.session.role };
}

// GET (liste) / POST (upload) /api/reclamations/:id/pieces
export async function handlePieces(request: Request, s: Services, reclamationId: string): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "C", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, uploadSchema);
    if (body instanceof Response) return body;

    if (!MIMES_AUTORISES.has(body.typeMime)) {
      return json(415, { error: "Type de fichier non autorisé (jpeg, png, pdf)." });
    }
    let data: Buffer;
    try {
      data = Buffer.from(body.contenuBase64, "base64");
    } catch {
      return json(400, { error: "Contenu base64 invalide." });
    }
    if (data.length === 0) return json(400, { error: "Fichier vide." });
    if (data.length > TAILLE_MAX_OCTETS) return json(413, { error: "Fichier trop volumineux." });

    const cle = nouvelleCle(auth.ctx.organisationId);
    await putObject(s.storageDir, cle, data);
    try {
      const piece = await withTenant(s.app, auth.ctx, async (tx) => {
        const row = await creerPieceRow(tx, auth.ctx.organisationId, acteurDe(auth), {
          reclamationId,
          nomFichier: body.nomFichier,
          typeMime: body.typeMime,
          tailleOctets: data.length,
          cleStockage: cle,
          auteurUtilisateurId: auth.session.utilisateurId,
        });
        if (row) {
          await recordAudit(tx, auth.ctx.organisationId, {
            utilisateurId: auth.session.utilisateurId,
            action: "piece.upload",
            objetType: "PieceJointe",
            objetId: row.id,
            resume: `${body.nomFichier} (${data.length} o)`,
          });
        }
        return row;
      });
      if (!piece) {
        await removeObject(s.storageDir, cle); // réclamation absente/hors périmètre
        return json(404, { error: "Réclamation introuvable." });
      }
      return json(201, {
        piece: {
          id: piece.id,
          nomFichier: piece.nomFichier,
          typeMime: piece.typeMime,
          tailleOctets: piece.tailleOctets,
        },
      });
    } catch (e) {
      await removeObject(s.storageDir, cle);
      throw e;
    }
  }

  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const pieces = await withTenant(s.app, auth.ctx, (tx) =>
    listPieces(tx, auth.ctx.organisationId, acteurDe(auth), reclamationId),
  );
  return pieces ? json(200, { pieces }) : json(404, { error: "Réclamation introuvable." });
}

// GET /api/pieces/:id — téléchargement médié (autorisation + propriété).
export async function handlePieceTelechargement(request: Request, s: Services, id: string): Promise<Response> {
  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const piece = await withTenant(s.app, auth.ctx, (tx) =>
    getPieceAutorisee(tx, auth.ctx.organisationId, acteurDe(auth), id),
  );
  if (!piece) return json(404, { error: "Introuvable." });

  const data = await getObject(s.storageDir, piece.cleStockage);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "content-type": piece.typeMime,
      "content-disposition": `attachment; filename="${piece.nomFichier.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
