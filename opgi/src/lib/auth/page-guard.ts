// Garde pour les pages (App Router) : exige une session, résout l'organisme.
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/next-session";
import { getServices, type Services } from "@/lib/services";
import { resolveTenant } from "@/lib/tenant/resolve";
import type { TenantContext, VerifiedSession } from "@/lib/tenant/context";

export interface PageTenant {
  session: VerifiedSession;
  s: Services;
  ctx: TenantContext;
}

export async function requirePageTenant(): Promise<PageTenant> {
  const session = await getServerSession();
  if (!session) redirect("/connexion");
  const s = getServices();
  const ctx = resolveTenant(session, s.config);
  return { session, s, ctx };
}
