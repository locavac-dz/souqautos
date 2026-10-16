// Aides partagées des handlers : lecture JSON, CSRF des mutations, traduction
// des erreurs Prisma/service en réponses HTTP.
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { isSameOriginRequest } from "@/lib/http/csrf";
import { ReferenceInvalideError, RegleMetierError } from "@/lib/modules/a/service";
import { json } from "@/http/respond";

/** Vérifie l'origine (CSRF) pour les requêtes mutantes ; null si OK. */
export function csrfGuard(request: Request): Response | null {
  return isSameOriginRequest(request) ? null : json(403, { error: "Origine non autorisée." });
}

/** Parse et valide le corps JSON ; renvoie les données ou une Response 400. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { error: "Corps de requête invalide." });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Données invalides.", details: fieldErrors(parsed.error) });
  }
  return parsed.data;
}

function fieldErrors(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Traduit une erreur connue en Response, ou la relance. */
export function mapError(e: unknown): Response {
  if (e instanceof ReferenceInvalideError) return json(400, { error: e.message });
  if (e instanceof RegleMetierError) return json(409, { error: e.message });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return json(409, { error: "Référence déjà utilisée." });
    if (e.code === "P2025") return json(404, { error: "Introuvable." });
    if (e.code === "P2003") return json(400, { error: "Référence liée invalide." });
  }
  throw e;
}
