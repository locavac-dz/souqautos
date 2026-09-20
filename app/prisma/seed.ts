import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { catalogue, modelCategories, slugify } from "./catalogue-data";
import { equipmentCatalogue } from "./equipment-data";
import { communes } from "./commune-data";
import { generations } from "./generation-data";
import { resolveAdminBootstrap } from "../src/lib/admin-bootstrap";

const prisma = new PrismaClient();

// Compte administrateur : voir src/lib/admin-bootstrap.ts. Développement : convention
// du groupe INGENICA (admin@<nom-court>.dz) et mot de passe du README. Production :
// ADMIN_EMAIL et ADMIN_PASSWORD obligatoires (le mot de passe de développement est refusé).

// Les 69 wilayas officielles d'Algérie : 58 (découpage 2019) + 11 créées par la
// loi n° 26-06 du 4 avril 2026 (JORADP n° 25), codes 59 à 69.
const wilayas: { id: number; code: string; nomFr: string; nomAr: string }[] = [
  { id: 1, code: "01", nomFr: "Adrar", nomAr: "أدرار" },
  { id: 2, code: "02", nomFr: "Chlef", nomAr: "الشلف" },
  { id: 3, code: "03", nomFr: "Laghouat", nomAr: "الأغواط" },
  { id: 4, code: "04", nomFr: "Oum El Bouaghi", nomAr: "أم البواقي" },
  { id: 5, code: "05", nomFr: "Batna", nomAr: "باتنة" },
  { id: 6, code: "06", nomFr: "Béjaïa", nomAr: "بجاية" },
  { id: 7, code: "07", nomFr: "Biskra", nomAr: "بسكرة" },
  { id: 8, code: "08", nomFr: "Béchar", nomAr: "بشار" },
  { id: 9, code: "09", nomFr: "Blida", nomAr: "البليدة" },
  { id: 10, code: "10", nomFr: "Bouira", nomAr: "البويرة" },
  { id: 11, code: "11", nomFr: "Tamanrasset", nomAr: "تمنراست" },
  { id: 12, code: "12", nomFr: "Tébessa", nomAr: "تبسة" },
  { id: 13, code: "13", nomFr: "Tlemcen", nomAr: "تلمسان" },
  { id: 14, code: "14", nomFr: "Tiaret", nomAr: "تيارت" },
  { id: 15, code: "15", nomFr: "Tizi Ouzou", nomAr: "تيزي وزو" },
  { id: 16, code: "16", nomFr: "Alger", nomAr: "الجزائر" },
  { id: 17, code: "17", nomFr: "Djelfa", nomAr: "الجلفة" },
  { id: 18, code: "18", nomFr: "Jijel", nomAr: "جيجل" },
  { id: 19, code: "19", nomFr: "Sétif", nomAr: "سطيف" },
  { id: 20, code: "20", nomFr: "Saïda", nomAr: "سعيدة" },
  { id: 21, code: "21", nomFr: "Skikda", nomAr: "سكيكدة" },
  { id: 22, code: "22", nomFr: "Sidi Bel Abbès", nomAr: "سيدي بلعباس" },
  { id: 23, code: "23", nomFr: "Annaba", nomAr: "عنابة" },
  { id: 24, code: "24", nomFr: "Guelma", nomAr: "قالمة" },
  { id: 25, code: "25", nomFr: "Constantine", nomAr: "قسنطينة" },
  { id: 26, code: "26", nomFr: "Médéa", nomAr: "المدية" },
  { id: 27, code: "27", nomFr: "Mostaganem", nomAr: "مستغانم" },
  { id: 28, code: "28", nomFr: "M'Sila", nomAr: "المسيلة" },
  { id: 29, code: "29", nomFr: "Mascara", nomAr: "معسكر" },
  { id: 30, code: "30", nomFr: "Ouargla", nomAr: "ورقلة" },
  { id: 31, code: "31", nomFr: "Oran", nomAr: "وهران" },
  { id: 32, code: "32", nomFr: "El Bayadh", nomAr: "البيض" },
  { id: 33, code: "33", nomFr: "Illizi", nomAr: "إليزي" },
  { id: 34, code: "34", nomFr: "Bordj Bou Arréridj", nomAr: "برج بوعريريج" },
  { id: 35, code: "35", nomFr: "Boumerdès", nomAr: "بومرداس" },
  { id: 36, code: "36", nomFr: "El Tarf", nomAr: "الطارف" },
  { id: 37, code: "37", nomFr: "Tindouf", nomAr: "تندوف" },
  { id: 38, code: "38", nomFr: "Tissemsilt", nomAr: "تسمسيلت" },
  { id: 39, code: "39", nomFr: "El Oued", nomAr: "الوادي" },
  { id: 40, code: "40", nomFr: "Khenchela", nomAr: "خنشلة" },
  { id: 41, code: "41", nomFr: "Souk Ahras", nomAr: "سوق أهراس" },
  { id: 42, code: "42", nomFr: "Tipaza", nomAr: "تيبازة" },
  { id: 43, code: "43", nomFr: "Mila", nomAr: "ميلة" },
  { id: 44, code: "44", nomFr: "Aïn Defla", nomAr: "عين الدفلى" },
  { id: 45, code: "45", nomFr: "Naâma", nomAr: "النعامة" },
  { id: 46, code: "46", nomFr: "Aïn Témouchent", nomAr: "عين تموشنت" },
  { id: 47, code: "47", nomFr: "Ghardaïa", nomAr: "غرداية" },
  { id: 48, code: "48", nomFr: "Relizane", nomAr: "غليزان" },
  { id: 49, code: "49", nomFr: "Timimoun", nomAr: "تيميمون" },
  { id: 50, code: "50", nomFr: "Bordj Badji Mokhtar", nomAr: "برج باجي مختار" },
  { id: 51, code: "51", nomFr: "Ouled Djellal", nomAr: "أولاد جلال" },
  { id: 52, code: "52", nomFr: "Béni Abbès", nomAr: "بني عباس" },
  { id: 53, code: "53", nomFr: "In Salah", nomAr: "عين صالح" },
  { id: 54, code: "54", nomFr: "In Guezzam", nomAr: "عين قزام" },
  { id: 55, code: "55", nomFr: "Touggourt", nomAr: "تقرت" },
  { id: 56, code: "56", nomFr: "Djanet", nomAr: "جانت" },
  { id: 57, code: "57", nomFr: "El M'Ghair", nomAr: "المغير" },
  { id: 58, code: "58", nomFr: "El Meniaa", nomAr: "المنيعة" },
  { id: 59, code: "59", nomFr: "Aflou", nomAr: "آفلو" },
  { id: 60, code: "60", nomFr: "Barika", nomAr: "بريكة" },
  { id: 61, code: "61", nomFr: "El Kantara", nomAr: "القنطرة" },
  { id: 62, code: "62", nomFr: "Bir El Ater", nomAr: "بئر العاتر" },
  { id: 63, code: "63", nomFr: "El Aricha", nomAr: "العريشة" },
  { id: 64, code: "64", nomFr: "Ksar Chellala", nomAr: "قصر الشلالة" },
  { id: 65, code: "65", nomFr: "Aïn Ouessara", nomAr: "عين وسارة" },
  { id: 66, code: "66", nomFr: "Messaad", nomAr: "مسعد" },
  { id: 67, code: "67", nomFr: "Ksar El Boukhari", nomAr: "قصر البخاري" },
  { id: 68, code: "68", nomFr: "Bou Saâda", nomAr: "بوسعادة" },
  { id: 69, code: "69", nomFr: "El Abiodh Sidi Cheikh", nomAr: "الأبيض سيدي الشيخ" },
];

async function main() {
  for (const w of wilayas) {
    const slug = slugify(w.nomFr);
    await prisma.wilaya.upsert({
      where: { id: w.id },
      update: { code: w.code, nomFr: w.nomFr, nomAr: w.nomAr, slug },
      create: { ...w, slug },
    });
  }
  console.log(`Seed OK — ${wilayas.length} wilayas.`);

  for (const c of communes) {
    await prisma.commune.upsert({
      where: { id: c.id },
      update: { wilayaId: c.wilayaId, nomFr: c.nomFr, nomAr: c.nomAr },
      create: c,
    });
  }
  console.log(`Seed OK — ${communes.length} communes.`);

  let modelCount = 0;
  for (const entry of catalogue) {
    const { brand, nameAr, models } = entry;
    const brandRow = await prisma.brand.upsert({
      where: { slug: slugify(brand) },
      update: { name: brand, nameAr: nameAr ?? null },
      create: { slug: slugify(brand), name: brand, nameAr },
    });

    for (const model of models) {
      const modelName = typeof model === "string" ? model : model.name;
      const modelNameAr = typeof model === "string" ? null : (model.nameAr ?? null);
      // Lot 130 — catégories d'annonce du modèle (voiture / utilitaire / poids lourd / deux-roues).
      const categories = modelCategories(entry, model);
      await prisma.model.upsert({
        where: { brandId_slug: { brandId: brandRow.id, slug: slugify(modelName) } },
        update: { name: modelName, nameAr: modelNameAr, categories },
        create: { brandId: brandRow.id, slug: slugify(modelName), name: modelName, nameAr: modelNameAr, categories },
      });
      modelCount += 1;
    }
  }
  console.log(`Seed OK — ${catalogue.length} marques, ${modelCount} modèles.`);

  for (const g of generations) {
    await prisma.generation.upsert({
      where: { modelId_name: { modelId: g.modelId, name: g.name } },
      update: { yearStart: g.yearStart, yearEnd: g.yearEnd },
      create: g,
    });
  }
  console.log(`Seed OK — ${generations.length} générations.`);

  for (const item of equipmentCatalogue) {
    await prisma.equipment.upsert({
      where: { slug: item.slug },
      update: { nameFr: item.nameFr, nameAr: item.nameAr, category: item.category },
      create: item,
    });
  }
  console.log(`Seed OK — ${equipmentCatalogue.length} équipements.`);

  const admin = resolveAdminBootstrap(process.env);
  if (!admin.ok) {
    console.error(`Seed — compte admin NON créé : ${admin.error}`);
    process.exitCode = 1;
    return;
  }
  const ADMIN_EMAIL = admin.email;
  const ADMIN_PASSWORD = admin.password;

  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        role: "ADMIN",
        profile: { create: { displayName: "Administrateur Souq Auto" } },
      },
    });
    console.log(
      admin.usesDevDefaults
        ? `Seed OK — compte admin de DÉVELOPPEMENT créé (${ADMIN_EMAIL} / voir README pour le mot de passe de dev).`
        : `Seed OK — compte admin créé (${ADMIN_EMAIL}).`
    );
  } else if (existingAdmin.role !== "ADMIN") {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { role: "ADMIN" } });
    console.log(`Seed OK — rôle ADMIN réappliqué à ${ADMIN_EMAIL}.`);
  } else {
    console.log(`Seed OK — compte admin déjà présent (${ADMIN_EMAIL}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
