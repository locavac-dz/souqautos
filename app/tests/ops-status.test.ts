import { describe, expect, it } from "vitest";
import {
  NOTIFY_COOLDOWN_MS,
  buildOpsAlertEmail,
  evaluateOps,
  problemSignature,
  shouldNotify,
  summarizeOps,
  type BackupFile,
  type OpsFacts,
  type OpsStatus,
} from "@/lib/ops-status";

const NOW = Date.parse("2026-09-20T12:00:00Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const dump = (name: string, sizeBytes: number, msAgo: number): BackupFile => ({ name, sizeBytes, mtimeMs: NOW - msAgo });
const MB = 1024 * 1024;

// Une exploitation saine : sauvegarde d'il y a 8 h, restauration vérifiée il y a 10 jours, 7 archives stables.
function healthy(overrides: Partial<OpsFacts> = {}): OpsFacts {
  const dumps = Array.from({ length: 8 }, (_, i) => dump(`souq_auto-2026091${i}-020000.dump`, 20 * MB + i * 1000, (i + 1) * 20 * HOUR));
  const status: OpsStatus = {
    backup: { lastSuccess: { at: iso(8 * HOUR), file: dumps[0].name, sizeBytes: dumps[0].sizeBytes } },
    restoreCheck: { lastSuccess: { at: iso(10 * DAY), tables: 15 } },
  };
  return { now: NOW, status, dumps, freeBytes: 50 * 1024 * MB, health: { ok: true, httpStatus: 200, ms: 40 }, ...overrides };
}
const level = (facts: OpsFacts, id: string) => evaluateOps(facts).find((c) => c.id === id)?.level;

describe("evaluateOps — une exploitation saine", () => {
  it("ne signale rien", () => {
    const checks = evaluateOps(healthy());
    expect(summarizeOps(checks)).toMatchObject({ errors: 0, warnings: 0 });
    // Cinq contrôles, tous « ok » : la sauvegarde récente, son poids, la restauration, la place et le site.
    expect(checks.map((c) => c.id).sort()).toEqual(["backup-disk", "backup-recent", "backup-size", "restore-check", "site-health"]);
    expect(checks.every((c) => c.level === "ok")).toBe(true);
  });
});

describe("evaluateOps — la sauvegarde", () => {
  it("bloque si aucune sauvegarde n'est enregistrée (jamais lancée, ou mauvais dossier)", () => {
    expect(level(healthy({ status: null, dumps: [] }), "backup-recent")).toBe("error");
    expect(level(healthy({ status: {}, dumps: [] }), "backup-recent")).toBe("error");
  });

  it("dit qu'AUCUNE sauvegarde n'a jamais réussi quand il n'existe que des échecs, avec la raison", () => {
    const status: OpsStatus = { backup: { lastFailure: { at: iso(HOUR), reason: "pg_dump a échoué : mot de passe refusé" } } };
    const check = evaluateOps(healthy({ status, dumps: [] })).find((c) => c.id === "backup-recent")!;
    expect(check.level).toBe("error");
    expect(check.message).toContain("JAMAIS");
    expect(check.message).toContain("mot de passe refusé");
  });

  it("signale une nuit manquée : plus de 26 h sans sauvegarde réussie", () => {
    const facts = healthy();
    facts.status!.backup!.lastSuccess!.at = iso(27 * HOUR);
    expect(level(facts, "backup-recent")).toBe("error");
    facts.status!.backup!.lastSuccess!.at = iso(25 * HOUR);
    expect(level(facts, "backup-recent")).toBe("ok");
  });

  it("signale un ÉCHEC plus récent que la dernière réussite, même si celle-ci est récente", () => {
    const facts = healthy();
    facts.status!.backup!.lastFailure = { at: iso(HOUR), reason: "disque plein" };
    const check = evaluateOps(facts).find((c) => c.id === "backup-recent")!;
    expect(check.level).toBe("error");
    expect(check.message).toContain("disque plein");
  });

  it("n'en veut pas à un ancien échec suivi d'une réussite", () => {
    const facts = healthy();
    facts.status!.backup!.lastFailure = { at: iso(30 * HOUR), reason: "réseau" };
    expect(level(facts, "backup-recent")).toBe("ok");
  });

  it("signale une archive effacée : le journal la promet, le dossier ne l'a plus", () => {
    const facts = healthy();
    facts.dumps = facts.dumps.slice(1);
    expect(level(facts, "backup-file")).toBe("error");
  });

  it("signale une archive vide ou tronquée", () => {
    const facts = healthy();
    facts.dumps[0] = { ...facts.dumps[0], sizeBytes: 300 };
    expect(level(facts, "backup-size")).toBe("error");
  });

  it("avertit quand la dernière archive pèse moins de la moitié de la médiane des précédentes (données perdues ?)", () => {
    const facts = healthy();
    facts.dumps[0] = { ...facts.dumps[0], sizeBytes: 9 * MB };
    expect(level(facts, "backup-size")).toBe("warning");
    facts.dumps[0] = { ...facts.dumps[0], sizeBytes: 11 * MB };
    expect(level(facts, "backup-size")).toBe("ok");
  });

  it("ne juge pas le poids sans historique suffisant (installation neuve)", () => {
    const facts = healthy();
    facts.dumps = facts.dumps.slice(0, 2);
    facts.dumps[0] = { ...facts.dumps[0], sizeBytes: 2 * MB };
    expect(level(facts, "backup-size")).toBe("ok");
  });

  it("ignore les fichiers qui ne sont pas des archives de base", () => {
    const facts = healthy();
    facts.dumps.push(dump("notes.txt", 1, 1), dump("uploads-20260919-020000.tar.gz", 1, 1));
    expect(summarizeOps(evaluateOps(facts))).toMatchObject({ errors: 0, warnings: 0 });
  });
});

describe("evaluateOps — le test de restauration", () => {
  it("avertit quand il n'a jamais été fait, ou date de plus de 35 jours", () => {
    const never = healthy();
    delete never.status!.restoreCheck;
    expect(level(never, "restore-check")).toBe("warning");
    const old = healthy();
    old.status!.restoreCheck!.lastSuccess!.at = iso(36 * DAY);
    expect(level(old, "restore-check")).toBe("warning");
    old.status!.restoreCheck!.lastSuccess!.at = iso(34 * DAY);
    expect(level(old, "restore-check")).toBe("ok");
  });

  it("bloque quand le dernier test a ÉCHOUÉ : les sauvegardes ne sont plus dignes de confiance", () => {
    const facts = healthy();
    facts.status!.restoreCheck!.lastFailure = { at: iso(DAY), reason: "table users absente" };
    const check = evaluateOps(facts).find((c) => c.id === "restore-check")!;
    expect(check.level).toBe("error");
    expect(check.message).toContain("table users absente");
  });
});

describe("evaluateOps — le disque et le site", () => {
  it("bloque quand il ne reste pas de quoi écrire la prochaine sauvegarde, avertit sous 5 sauvegardes", () => {
    const facts = healthy();
    facts.freeBytes = 40 * MB;
    expect(level(facts, "backup-disk")).toBe("error");
    facts.freeBytes = 60 * MB + 20 * MB * 1.2; // juste assez pour une
    expect(level(facts, "backup-disk")).toBe("warning");
    facts.freeBytes = 10 * 1024 * MB;
    expect(level(facts, "backup-disk")).toBe("ok");
  });

  it("ne dit rien de la place quand elle est inconnue", () => {
    expect(evaluateOps(healthy({ freeBytes: null })).some((c) => c.id === "backup-disk")).toBe(false);
  });

  it("bloque quand le site ne répond pas ou répond une erreur, avertit quand il est lent, se tait si non demandé", () => {
    expect(level(healthy({ health: { ok: false, error: "ECONNREFUSED" } }), "site-health")).toBe("error");
    expect(level(healthy({ health: { ok: false, httpStatus: 503 } }), "site-health")).toBe("error");
    expect(level(healthy({ health: { ok: true, httpStatus: 200, ms: 4500 } }), "site-health")).toBe("warning");
    expect(evaluateOps(healthy({ health: null })).some((c) => c.id === "site-health")).toBe(false);
  });
});

describe("prévenir sans harceler", () => {
  const broken = () => {
    const facts = healthy();
    facts.status!.backup!.lastSuccess!.at = iso(40 * HOUR);
    return evaluateOps(facts);
  };

  it("l'empreinte ne contient que les problèmes (erreurs ; avertissements seulement si demandé)", () => {
    const facts = healthy({ health: { ok: false, error: "x" } });
    delete facts.status!.restoreCheck;
    const checks = evaluateOps(facts);
    expect(problemSignature(checks, false)).toBe("site-health:error");
    expect(problemSignature(checks, true)).toBe("restore-check:warning|site-health:error");
    expect(problemSignature(evaluateOps(healthy()), true)).toBe("");
  });

  it("prévient d'un nouveau problème tout de suite, rappelle après 6 h, se tait entre-temps et quand tout va bien", () => {
    const signature = problemSignature(broken(), false);
    expect(signature).toBe("backup-recent:error");
    expect(shouldNotify(signature, undefined, NOW)).toBe(true);
    expect(shouldNotify(signature, { lastSignature: signature, lastNotifiedAt: iso(HOUR) }, NOW)).toBe(false);
    expect(shouldNotify(signature, { lastSignature: signature, lastNotifiedAt: iso(NOTIFY_COOLDOWN_MS + 1000) }, NOW)).toBe(true);
    expect(shouldNotify(signature, { lastSignature: "site-health:error", lastNotifiedAt: iso(60_000) }, NOW)).toBe(true); // autre problème : tout de suite
    expect(shouldNotify("", { lastSignature: signature, lastNotifiedAt: iso(9 * HOUR) }, NOW)).toBe(false);
  });

  it("le courriel liste chaque problème avec sa correction, échappe le texte, et distingue problème et simple attention", () => {
    const facts = healthy();
    facts.status!.backup!.lastFailure = { at: iso(HOUR), reason: "<script>alert(1)</script>" };
    delete facts.status!.restoreCheck;
    const email = buildOpsAlertEmail(evaluateOps(facts), true);
    expect(email.subject).toContain("PROBLÈME");
    expect(email.subject).toContain("2 points");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("npm run db:restore-check");
    const warningsOnly = healthy();
    delete warningsOnly.status!.restoreCheck;
    expect(buildOpsAlertEmail(evaluateOps(warningsOnly), true).subject).toContain("Attention");
  });
});
