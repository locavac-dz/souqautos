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
// Codes (audit E4, Lot 279) : 401 « unauthenticated » (anonyme, même sur une route d'équipe), 403 « forbidden »
// (rôle insuffisant), 400 « validation », 409 pour tout « already_* » et toute course perdue. Voir src/lib/http.ts.
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
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
// Lot 279 (audit E4) — anonyme → 401 « unauthenticated » partout ; rôle insuffisant → 403 « forbidden ».
export async function requireRole(
  predicate: (role: Role) => boolean,
  options: GuardOptions = {}
): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: options.headers });
  }
  if (!predicate(user.role)) {
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

// Lot 279 (audit E6) — enveloppe commune des routes API : une exception non prévue devient un 500 JSON
// `{ error: "internal_error" }` lisible par le client (au lieu d'une page texte de Next), et reste signalée à
// l'équipe technique exactement comme avant (server-error-alerts, les mêmes garde-fous qu'instrumentation.ts).
// Les redirections et 404 de Next (erreurs internes à relancer) sont laissées passer.
type RouteArgs = unknown[];

export function apiHandler<A extends RouteArgs>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      unstable_rethrow(error);
      const request = args[0] as { url?: string; method?: string } | undefined;
      const path = request?.url ? safePath(request.url) : "?";
      const method = request?.method ?? "?";
      if (process.env.NEXT_RUNTIME !== "edge") {
        void import("@/lib/server-error-alerts").then(({ reportServerError }) =>
          reportServerError(error, { path, method }, { routeType: "route", routerKind: "App Router" })
        );
      }
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "?";
  }
}
