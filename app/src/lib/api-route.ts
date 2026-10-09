// Lot 271 (audit E1) — briques communes des routes API.
//
// Avant ce lot, chaque route répétait la même garde d'authentification (une centaine de fois) et la même
// lecture de corps JSON (« request.json().catch(() => null) » puis « safeParse » puis 400 — plus de 80 fois).
// Trois fonctions remplacent ces répétitions. Convention d'appel, volontairement sans exception ni wrapper :
//
//   const user = await requireUser();
//   if (user instanceof NextResponse) return user;
//
//   const body = await parseJsonBody(request, schema);
//   if (body instanceof NextResponse) return body;
//
// Une réponse NextResponse est renvoyée telle quelle ; sinon on a l'utilisateur (ou le corps validé) typé.
// Les codes restent ceux d'avant : 401 « unauthenticated » (anonyme), 403 « forbidden » (rôle insuffisant —
// y compris pour un anonyme sur une route d'équipe, comme avant), 400 « validation ».
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server/current-user";

// Réponses à ne jamais mettre en cache (codes de récupération, abonnements push, prospects…).
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type GuardOptions = { headers?: HeadersInit };

// Utilisateur connecté, sinon 401.
export async function requireUser(options: GuardOptions = {}): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: options.headers });
  }
  return user;
}

// Utilisateur connecté dont le rôle satisfait `predicate` (isAdmin, isStaff, isModerator…), sinon 403.
export async function requireRole(
  predicate: (role: Role) => boolean,
  options: GuardOptions = {}
): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user || !predicate(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: options.headers });
  }
  return user;
}

type BodyOptions = {
  headers?: HeadersInit;
  // "full" : renvoie les `issues` zod telles quelles (formulaires publics qui les affichent champ par champ) ;
  // "paths" : seulement les chemins des champs fautifs.
  issues?: "full" | "paths";
};

// Corps JSON validé par `schema`, sinon 400 « validation » (JSON illisible compris).
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: { json(): Promise<unknown> },
  schema: S,
  options: BodyOptions = {}
): Promise<z.output<S> | NextResponse> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const payload =
    options.issues === "full"
      ? { error: "validation", issues: parsed.error.issues }
      : options.issues === "paths"
        ? { error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }
        : { error: "validation" };
  return NextResponse.json(payload, { status: 400, headers: options.headers });
}
