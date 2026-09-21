// Lot 144 — `npm run content:guide-general -- [--author adresse@admin] [--env chemin/fichier.env]`
//
// Crée le guide d'achat GÉNÉRAL (« Acheter une voiture d'occasion : le guide complet, étape par étape », src/content/general-buying-guide.ts)
// EN BROUILLON. Il n'est JAMAIS publié par ce script : une personne de l'équipe le relit dans « Administration → Guides d'achat »
// (surtout les démarches administratives et la version arabe), le corrige au besoin, puis le publie elle-même.
//
//  - Refuse d'en créer un second : si un guide général existe déjà (brouillon, programmé ou publié), il le dit et ne touche à rien.
//  - L'auteur est un ADMINISTRATEUR : celui que désigne --author, sinon le plus ancien compte administrateur.
//  - Le texte passe par le MÊME schéma de validation que le formulaire d'administration : un texte qui violerait une règle
//    (longueur, langues, liste à vérifier…) échoue ici au lieu de s'insérer.

import { existsSync } from "node:fs";
import path from "node:path";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const envFile = path.resolve(process.cwd(), argValue("--env") ?? ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  else if (argValue("--env")) {
    console.error(`Fichier de configuration introuvable : ${envFile}`);
    process.exit(2);
  }

  // Importés ICI, après le chargement de la configuration : ces modules lisent la base au premier appel.
  const { prisma } = await import("../src/lib/prisma");
  const { blogArticleSchema } = await import("../src/lib/validation/blog");
  const { toBuyingGuideData } = await import("../src/lib/buying-guide");
  const { slugify } = await import("../src/lib/slugify");
  const { generateUniqueSlug, RESERVED_SLUGS } = await import("../src/lib/blog");
  const { writeAuditLog } = await import("../src/lib/audit-log");
  const { GENERAL_BUYING_GUIDE: guide } = await import("../src/content/general-buying-guide");

  try {
    const existing = await prisma.blogArticle.findFirst({
      where: { kind: "GUIDE", guide: { modelId: null } },
      select: { slug: true, publishedAt: true },
    });
    if (existing) {
      const state = existing.publishedAt === null ? "brouillon" : existing.publishedAt > new Date() ? "programmé" : "publié";
      console.log(`Un guide général existe déjà (/guides/${existing.slug}, ${state}) : rien n'est créé. Modifiez-le dans « Administration → Guides d'achat ».`);
      return;
    }

    const authorEmail = argValue("--author")?.trim().toLowerCase();
    const author = authorEmail
      ? await prisma.user.findUnique({ where: { email: authorEmail }, select: { id: true, role: true, email: true } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, email: true } });
    if (!author) {
      console.error(authorEmail ? `Aucun compte avec l'adresse ${authorEmail}.` : "Aucun compte administrateur : `npm run db:seed` en crée un (ADMIN_EMAIL / ADMIN_PASSWORD), ou désignez-en un avec --author.");
      process.exit(1);
    }
    if (author.role !== "ADMIN") {
      console.error(`${author.email} n'est pas administrateur : seul un administrateur signe un guide.`);
      process.exit(1);
    }

    const parsed = blogArticleSchema.safeParse({
      kind: "GUIDE",
      titleFr: guide.titleFr,
      titleAr: guide.titleAr,
      excerptFr: guide.excerptFr,
      excerptAr: guide.excerptAr,
      contentFr: guide.contentFr,
      contentAr: guide.contentAr,
      publication: { mode: "draft" },
      guide: { checklistFr: guide.checklistFr, checklistAr: guide.checklistAr, adviceFr: guide.adviceFr, adviceAr: guide.adviceAr },
    });
    if (!parsed.success || !parsed.data.guide) {
      console.error("Le texte du guide ne respecte pas les règles de l'administration :");
      for (const issue of parsed.success ? [] : parsed.error.issues) console.error(`  - ${issue.path.join(".")} : ${issue.message}`);
      process.exit(3);
    }
    const data = parsed.data;

    const slugs = (await prisma.blogArticle.findMany({ select: { slug: true } })).map((a) => a.slug);
    const slug = generateUniqueSlug(slugify(data.titleFr), [...slugs, ...RESERVED_SLUGS]);
    const article = await prisma.blogArticle.create({
      data: {
        slug,
        kind: "GUIDE",
        titleFr: data.titleFr,
        titleAr: data.titleAr,
        excerptFr: data.excerptFr,
        excerptAr: data.excerptAr,
        contentFr: data.contentFr,
        contentAr: data.contentAr,
        authorId: author.id,
        publishedAt: null, // BROUILLON : jamais publié par ce script
        guide: { create: toBuyingGuideData(data.guide!, null) },
      },
      select: { id: true, slug: true },
    });
    await writeAuditLog({
      adminId: author.id,
      action: "blog_article.create",
      targetType: "BlogArticle",
      targetId: article.id,
      details: { titleFr: data.titleFr, kind: "GUIDE", status: "draft", by: "commande" },
    });

    console.log(`Guide général créé EN BROUILLON : /guides/${article.slug} (signé ${author.email}).`);
    console.log("À faire : le relire dans « Administration → Guides d'achat » (démarches administratives, version arabe), puis le publier.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
