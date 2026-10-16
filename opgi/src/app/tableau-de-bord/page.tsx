import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/auth/next-session";
import { getServices } from "@/lib/services";
import { resolveTenant } from "@/lib/tenant/resolve";
import { withTenant } from "@/lib/tenant/prisma";
import { can, type RoleName } from "@/lib/authz/permissions";
import {
  indicateursPatrimoine,
  indicateursReclamations,
  indicateursProjets,
  type IndicateursPatrimoine,
  type IndicateursReclamations,
  type IndicateursProjets,
} from "@/lib/modules/dashboard";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

function dzd(c: number): string {
  return (c / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 }) + " DZD";
}

function Stat({ label, value, def }: { label: string; value: ReactNode; def: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, minWidth: 180, flex: "1 1 180px" }}>
      <div className="meta" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, margin: "4px 0" }}>{value}</div>
      <div className="meta" style={{ fontSize: "0.8rem" }}>{def}</div>
    </div>
  );
}

function Grille({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>{children}</div>;
}

export default async function TableauDeBord() {
  const session = await getServerSession();
  if (!session) redirect("/connexion");

  const t = await getTranslations("indicateurs");
  const s = getServices();
  const ctx = resolveTenant(session, s.config);
  const role = session.role as RoleName;
  const voitA = can(role, "A", "lire");
  const voitC = can(role, "C", "lire");
  const voitB = can(role, "B", "lire");

  const data = await withTenant(s.app, ctx, async (tx) => ({
    a: voitA ? await indicateursPatrimoine(tx, ctx.organisationId) : null,
    c: voitC ? await indicateursReclamations(tx, ctx.organisationId) : null,
    b: voitB ? await indicateursProjets(tx, ctx.organisationId) : null,
  }));

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <p className="meta">
        {session.organisationId} — {role}
      </p>

      {!voitA && !voitC && !voitB && <p role="alert">{t("defAucuneSection")}</p>}

      {data.a && <SectionPatrimoine i={data.a} t={t} />}
      {data.c && <SectionReclamations i={data.c} t={t} />}
      {data.b && <SectionProjets i={data.b} t={t} />}

      <p className="meta" style={{ marginTop: 16 }}>{t("note")}</p>
    </main>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function SectionPatrimoine({ i, t }: { i: IndicateursPatrimoine; t: T }) {
  return (
    <section className="card" aria-label={t("sectionPatrimoine")} style={{ marginTop: 16 }}>
      <h2>{t("sectionPatrimoine")}</h2>
      <Grille>
        <Stat label={t("biensTotal")} value={i.biens.total} def={t("biensTotalDef")} />
        <Stat label={t("tauxOccupation")} value={`${i.biens.tauxOccupationPct}%`} def={t("tauxOccupationDef")} />
        <Stat label={t("occupes")} value={i.biens.occupes} def={t("tauxOccupationDef")} />
        <Stat label={t("vacants")} value={i.biens.vacants} def={t("biensTotalDef")} />
        <Stat label={t("contratsActifs")} value={i.contratsActifs} def={t("contratsActifsDef")} />
      </Grille>
      <Grille>
        <Stat label={t("du")} value={dzd(i.financier.duCentimes)} def={t("duDef")} />
        <Stat label={t("impute")} value={dzd(i.financier.imputeCentimes)} def={t("imputeDef")} />
        <Stat label={t("solde")} value={dzd(i.financier.soldeCentimes)} def={t("soldeDef")} />
        <Stat label={t("tauxRecouvrement")} value={`${i.financier.tauxRecouvrementPct}%`} def={t("tauxRecouvrementDef")} />
        <Stat label={t("nbImpayes")} value={i.financier.nbImpayes} def={t("nbImpayesDef")} />
      </Grille>
    </section>
  );
}

function repartition(parStatut: Record<string, number>): string {
  const entries = Object.entries(parStatut);
  return entries.length === 0 ? "—" : entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

function SectionReclamations({ i, t }: { i: IndicateursReclamations; t: T }) {
  return (
    <section className="card" aria-label={t("sectionReclamations")} style={{ marginTop: 16 }}>
      <h2>{t("sectionReclamations")}</h2>
      <Grille>
        <Stat label={t("reclamationsOuvertes")} value={i.totalOuvertes} def={t("reclamationsOuvertesDef")} />
        <Stat label={t("reclamationsParStatut")} value={<span style={{ fontSize: "0.95rem" }}>{repartition(i.parStatut)}</span>} def={t("reclamationsParStatut")} />
        <Stat label={t("ordresParStatut")} value={<span style={{ fontSize: "0.95rem" }}>{repartition(i.ordresParStatut)}</span>} def={t("ordresParStatut")} />
      </Grille>
    </section>
  );
}

function SectionProjets({ i, t }: { i: IndicateursProjets; t: T }) {
  return (
    <section className="card" aria-label={t("sectionProjets")} style={{ marginTop: 16 }}>
      <h2>{t("sectionProjets")}</h2>
      <Grille>
        <Stat label={t("projetsTotal")} value={i.projetsTotal} def={t("projetsTotalDef")} />
        <Stat label={t("marchesTotal")} value={i.marchesTotal} def={t("marchesTotalDef")} />
        <Stat label={t("engage")} value={dzd(i.montantEngageCentimes)} def={t("engageDef")} />
        <Stat label={t("constate")} value={dzd(i.montantConstateCentimes)} def={t("constateDef")} />
        <Stat label={t("avancementFinancier")} value={`${i.avancementFinancierPct}%`} def={t("avancementFinancierDef")} />
        <Stat label={t("nbDepassement")} value={i.nbDepassement} def={t("nbDepassementDef")} />
        <Stat label={t("nbRetard")} value={i.nbRetard} def={t("nbRetardDef")} />
      </Grille>
    </section>
  );
}
