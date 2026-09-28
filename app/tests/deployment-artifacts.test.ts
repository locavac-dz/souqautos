import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as { load(text: string): unknown };

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

// Lot 233 — le fichier est ANALYSÉ (YAML, ancres et fusions comprises) : c'est ce que ferait `docker compose`.
type Service = { image?: string; build?: { context?: string; target?: string; args?: Record<string, string> }; command?: string[]; volumes?: string[]; ports?: string[]; environment?: Record<string, string> };
const compose = yaml.load(read(path.join(APP, "docker-compose.example.yml"))) as { services: Record<string, Service> };
const dockerfile = read(path.join(APP, "Dockerfile"));
const stageExists = (name: string) => new RegExp(`^FROM .+ AS ${name}$`, "m").test(dockerfile);

describe("docker-compose.example.yml — chaque service construit SA cible du Dockerfile (Lot 233)", () => {
  it("app → runner, migrate → migrate, tools → tools, trois images distinctes", () => {
    expect(compose.services.app.build?.target).toBe("runner");
    expect(compose.services.migrate.build?.target).toBe("migrate");
    expect(compose.services.tools.build?.target).toBe("tools");
    for (const service of Object.values(compose.services)) expect(stageExists(service.build!.target!), service.build?.target).toBe(true);
    expect(new Set(Object.values(compose.services).map((s) => s.image)).size).toBe(3);
  });

  it("l'application et les outils reçoivent NEXT_PUBLIC_SITE_URL à la construction", () => {
    expect(compose.services.app.build?.args).toHaveProperty("NEXT_PUBLIC_SITE_URL");
    expect(compose.services.tools.build?.args).toHaveProperty("NEXT_PUBLIC_SITE_URL");
  });

  it("migrate n'écrase pas la commande de sa cible (prisma migrate deploy), et les trois reçoivent la configuration", () => {
    expect(compose.services.migrate.command).toBeUndefined();
    expect(dockerfile).toMatch(/AS migrate[\s\S]*?CMD \["npx", "prisma", "migrate", "deploy"\]/);
    for (const service of Object.values(compose.services)) expect(service.environment).toHaveProperty("DATABASE_URL");
  });

  it("tools monte les deux volumes de fichiers en LECTURE SEULE et les sauvegardes sur l'hôte (sinon perdues avec --rm)", () => {
    const volumes = compose.services.tools.volumes ?? [];
    expect(volumes).toContain("uploads:/app/public/uploads:ro");
    expect(volumes).toContain("private-uploads:/app/private-uploads:ro");
    expect(volumes).toContain("./backups:/app/backups");
  });

  it("l'application n'est publiée que sur 127.0.0.1 (jamais en direct : Nginx devant)", () => {
    expect(compose.services.app.ports).toEqual(["127.0.0.1:5184:5184"]);
  });
});

describe("ops/crontab.example — variante Docker (Lot 233)", () => {
  const crontab = read(path.join(APP, "ops", "crontab.example"));
  const pkg = JSON.parse(read(path.join(APP, "package.json"))) as { scripts: Record<string, string> };
  const dockerLines = crontab.split("\n").filter((line) => /^[0-9*]/.test(line) && line.includes("docker compose run"));

  it("planifie sauvegarde, veilleur (avec --notify) et test de restauration, via le service tools, sans terminal", () => {
    expect(dockerLines).toHaveLength(3);
    for (const line of dockerLines) expect(line).toContain("docker compose run --rm -T tools npm run ");
    expect(dockerLines.some((l) => l.includes("db:backup -- --with-uploads"))).toBe(true);
    expect(dockerLines.some((l) => l.includes("ops:check -- --notify"))).toBe(true);
    expect(dockerLines.some((l) => l.includes("db:restore-check"))).toBe(true);
  });

  it("ne lance que des scripts npm qui existent", () => {
    for (const line of dockerLines) {
      const script = line.match(/npm run ([a-z:-]+)/)?.[1];
      expect(pkg.scripts, `${script}`).toHaveProperty(script!);
    }
  });
});

describe("docs/DEPLOIEMENT.md — taille des envois derrière Nginx (Lot 233)", () => {
  const doc = read(path.join(ROOT, "docs", "DEPLOIEMENT.md"));
  const mb = (pattern: RegExp, text: string) => Number(text.match(pattern)?.[1]);

  it("l'emplacement /api/listings accepte 10 photos au maximum de leur taille, calculé depuis le code", () => {
    const maxPhotos = Math.max(
      mb(/const MAX_PHOTOS = (\d+);/, read(path.join(APP, "src", "app", "api", "listings", "route.ts"))),
      mb(/const MAX_PHOTOS = (\d+);/, read(path.join(APP, "src", "app", "api", "listings", "[id]", "route.ts")))
    );
    const photoMb = mb(/const MAX_PHOTO_BYTES = (\d+) \* 1024 \* 1024;/, read(path.join(APP, "src", "lib", "uploads.ts")));
    expect(maxPhotos).toBeGreaterThan(0);
    expect(photoMb).toBeGreaterThan(0);
    const listingsBlock = doc.match(/location \/api\/listings \{[\s\S]*?\}/)?.[0] ?? "";
    expect(mb(/client_max_body_size (\d+)m;/, listingsBlock)).toBeGreaterThan(maxPhotos * photoMb);
  });

  it("la limite générale couvre le plus gros envoi à fichier unique (bannière, couverture, pièce d'identité)", () => {
    const uploads = read(path.join(APP, "src", "lib", "uploads.ts"));
    const identity = read(path.join(APP, "src", "lib", "identity-uploads.ts"));
    const largest = Math.max(...[...uploads.matchAll(/const MAX_[A-Z]+_BYTES = (\d+) \* 1024 \* 1024;/g), ...identity.matchAll(/const MAX_BYTES = (\d+) \* 1024 \* 1024;/g)].map((m) => Number(m[1])));
    const serverLevel = doc.match(/server \{\n[\s\S]*?client_max_body_size (\d+)m;/)?.[1];
    expect(Number(serverLevel)).toBeGreaterThan(largest);
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
