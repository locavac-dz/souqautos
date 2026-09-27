import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Lot 147 — vérification des artefacts de déploiement. Ces tests prouvent que les fichiers
// nécessaires à la mise en production existent et sont cohérents entre eux, SANS construire
// l'image Docker (Docker n'est pas installé sur la machine de développement). Ce que la CI
// (.github/workflows/ci.yml, tâche « docker ») vérifie en plus : que l'image se construit.

const APP = path.resolve(__dirname, "..");
const ROOT = path.resolve(APP, "..");

const read = (p: string) => readFileSync(p, "utf8");
const exists = (p: string) => existsSync(p);

describe("Dockerfile", () => {
  it("existe dans app/", () => {
    expect(exists(path.join(APP, "Dockerfile"))).toBe(true);
  });

  it("utilise une image de base Debian (et non Alpine) pour les binaires Prisma/sharp précompilés", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toMatch(/bookworm-slim/);
    // Les lignes FROM ne doivent pas référencer une image alpine
    const fromLines = content.split("\n").filter((l) => /^FROM\s/i.test(l));
    expect(fromLines.every((l) => !l.toLowerCase().includes("alpine"))).toBe(true);
  });

  it("installe openssl (requis par le moteur Prisma)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("openssl");
  });

  it("active la sortie autonome (BUILD_STANDALONE=1)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("BUILD_STANDALONE=1");
  });

  it("définit NEXT_TELEMETRY_DISABLED (pas de télémétrie dans l'image)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("NEXT_TELEMETRY_DISABLED=1");
  });

  it("crée un utilisateur non-root souq:souq pour l'étape runner", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("souq");
    expect(content).toContain("USER souq");
  });

  it("déclare un VOLUME pour les photos (elles ne vivent pas dans l'image)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain('VOLUME ["/app/public/uploads"]');
  });

  it("déclare un VOLUME pour les pièces d'identité, créé et remis à l'utilisateur souq AVANT USER souq (Lot 230)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain('VOLUME ["/app/private-uploads"]');
    const prepared = content.indexOf("mkdir -p private-uploads/identity && chown -R souq:souq private-uploads");
    expect(prepared).toBeGreaterThan(-1);
    expect(prepared).toBeLessThan(content.indexOf("USER souq"));
  });

  it("expose le port de l'application (5184)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("EXPOSE 5184");
  });

  it("inclut un HEALTHCHECK via /api/health", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toContain("HEALTHCHECK");
    expect(content).toContain("/api/health");
  });

  it("inclut un stage « migrate » distinct (à lancer AVANT l'application)", () => {
    const content = read(path.join(APP, "Dockerfile"));
    expect(content).toMatch(/FROM.+AS migrate/);
    expect(content).toContain("prisma migrate deploy");
  });
});

describe(".dockerignore", () => {
  it("existe dans app/", () => {
    expect(exists(path.join(APP, ".dockerignore"))).toBe(true);
  });

  it("exclut les secrets (.env) mais PAS .env.example (nécessaire pour la documentation)", () => {
    const content = read(path.join(APP, ".dockerignore"));
    expect(content).toContain(".env");
    expect(content).toContain("!.env.example");
  });

  it("exclut node_modules et .next (reconstruits dans l'image)", () => {
    const content = read(path.join(APP, ".dockerignore"));
    expect(content).toContain("node_modules");
    expect(content).toContain(".next");
  });

  it("exclut les fichiers envoyés du poste de développement : photos ET pièces d'identité (données personnelles)", () => {
    const content = read(path.join(APP, ".dockerignore"));
    expect(content).toMatch(/^public\/uploads$/m);
    expect(content).toMatch(/^private-uploads$/m);
  });

  it("NE PAS exclure tests/ ni e2e/ (playwright.config.ts les importe : tsc échouerait)", () => {
    const content = read(path.join(APP, ".dockerignore"));
    // Ces dossiers ne doivent pas être exclus — vérifier l'absence de ligne exacte (pas de commentaire)
    expect(content).not.toMatch(/^tests\/?$/m);
    expect(content).not.toMatch(/^e2e\/?$/m);
    expect(content).not.toMatch(/^e2e-pwa\/?$/m);
  });
});

describe("next.config.ts — sortie autonome", () => {
  it("exporte la configuration avec la sortie autonome activable via BUILD_STANDALONE", () => {
    const content = read(path.join(APP, "next.config.mjs"));
    expect(content).toContain("BUILD_STANDALONE");
    expect(content).toContain("standalone");
  });
});

describe(".env.example — variables documentées", () => {
  const envExample = read(path.join(APP, ".env.example"));
  const defined = new Set(
    envExample.split("\n")
      .filter((l) => !l.startsWith("#") && l.includes("="))
      .map((l) => l.split("=")[0].replace(/^#\s*/, "").trim())
  );
  const mentioned = (name: string) => envExample.includes(name);

  it("mentionne SHADOW_DATABASE_URL (base vide pour la vérification des migrations)", () => {
    expect(mentioned("SHADOW_DATABASE_URL")).toBe(true);
  });

  it("mentionne CSP_REPORT_ONLY (politique de sécurité en mode observation)", () => {
    expect(mentioned("CSP_REPORT_ONLY")).toBe(true);
  });

  it("mentionne SMTP_SECURE (forcer le choix TLS/STARTTLS)", () => {
    expect(mentioned("SMTP_SECURE")).toBe(true);
  });

  it("les variables obligatoires en production sont définies avec une valeur (non commentées)", () => {
    for (const name of ["DATABASE_URL", "E2E_DATABASE_URL", "JWT_SECRET", "NEXT_PUBLIC_SITE_URL", "ENCRYPTION_KEY"]) {
      expect(defined.has(name), `${name} absent ou commenté`).toBe(true);
    }
  });
});

describe("docker-compose.example.yml", () => {
  it("existe dans app/", () => {
    expect(exists(path.join(APP, "docker-compose.example.yml"))).toBe(true);
  });

  it("inclut les services app et migrate (migrate lance les migrations avant l'app)", () => {
    const content = read(path.join(APP, "docker-compose.example.yml"));
    expect(content).toContain("migrate");
    expect(content).toContain("app:");
  });

  it("monte un volume pour les photos (pas dans l'image)", () => {
    const content = read(path.join(APP, "docker-compose.example.yml"));
    expect(content).toContain("uploads");
  });

  it("monte un volume distinct pour les pièces d'identité, au chemin qu'écrit src/lib/identity-uploads.ts", () => {
    const content = read(path.join(APP, "docker-compose.example.yml"));
    expect(content).toContain("private-uploads:/app/private-uploads");
    expect(content).toMatch(/^\s+private-uploads:/m);
  });
});

describe("docs/DEPLOIEMENT.md", () => {
  it("existe dans docs/", () => {
    expect(exists(path.join(ROOT, "docs", "DEPLOIEMENT.md"))).toBe(true);
  });

  it("mentionne ce qui est vérifié sans Docker et ce qui ne l'est pas", () => {
    const content = read(path.join(ROOT, "docs", "DEPLOIEMENT.md"));
    expect(content.toLowerCase()).toMatch(/v[eé]rif/);
    expect(content.toLowerCase()).toMatch(/docker/);
  });
});
