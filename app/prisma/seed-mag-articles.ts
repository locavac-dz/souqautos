// Lot 169 — Seed d'articles de démonstration pour la rubrique /mag.
//
// La base de démo est vide par défaut (aucun article publié).
// Ce script ajoute 5 articles publiés en FR/AR afin de permettre
// de tester la pagination, l'affichage et le flux RSS.
//
// Idempotent : les articles portent le marqueur [mag-seed] dans leur slug ;
// ils sont supprimés et recréés à chaque exécution.
//
// Utilisation : npm run db:seed:mag

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_TAG = "mag-seed";

const ARTICLES = [
  {
    slug: `${SEED_TAG}-marche-occasion-2025`,
    titleFr: "Le marché de l'occasion en Algérie : bilan 2025",
    titleAr: "سوق السيارات المستعملة في الجزائر: حصيلة 2025",
    excerptFr: "Quelles tendances ont marqué le marché automobile algérien cette année ? Prix, volumes, modèles les plus échangés.",
    excerptAr: "ما هي الاتجاهات التي طبعت سوق السيارات الجزائري هذا العام؟ الأسعار، الأحجام، أكثر الطرازات تداولاً.",
    contentFr: `## Un marché toujours porteur

L'année 2025 confirme la vigueur du marché automobile algérien de l'occasion. Malgré la pression inflationniste, les transactions ont progressé de près de 8 % par rapport à l'année précédente.

## Les modèles les plus recherchés

La Renault Clio et la Toyota Corolla dominent les recherches. La première attire les primo-accédants grâce à son prix d'entrée accessible, la seconde séduit par sa fiabilité reconnue sur le long terme.

## Conseils aux acheteurs

Avant de signer, vérifiez toujours l'historique d'entretien, faites contrôler le véhicule par un mécanicien indépendant et consultez la cote du modèle sur Souq Autos.`,
    contentAr: `## سوق واعد

أكّد عام 2025 قوة سوق السيارات المستعملة في الجزائر. وعلى الرغم من ضغوط التضخم، ارتفعت الصفقات بنسبة تقارب 8 % مقارنة بالعام الماضي.

## الطرازات الأكثر طلبًا

تهيمن رينو كليو وتويوتا كورولا على عمليات البحث. تستقطب الأولى المشترين لأول مرة بسعر دخول معقول، بينما تُغري الثانية بموثوقيتها المثبتة على المدى البعيد.

## نصائح للمشترين

قبل التوقيع، تحقق دائمًا من تاريخ الصيانة، واستعن بميكانيكي مستقل للكشف على السيارة، وراجع قيمة الطراز على سوق أوتو.`,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    slug: `${SEED_TAG}-transition-electrique`,
    titleFr: "La transition électrique en Algérie : où en sommes-nous ?",
    titleAr: "التحول نحو الكهرباء في الجزائر: أين نحن الآن؟",
    excerptFr: "Infrastructures de recharge, modèles disponibles, aides à l'achat : l'état des lieux du véhicule électrique en Algérie.",
    excerptAr: "بنية الشحن، الطرازات المتاحة، دعم الشراء: جردة حال السيارة الكهربائية في الجزائر.",
    contentFr: `## Un démarrage prudent

Le véhicule électrique peine encore à s'imposer sur le marché algérien. La part de marché reste marginale, freinée par le manque d'infrastructure de recharge et l'incertitude sur les prix des pièces détachées.

## Les initiatives en cours

Plusieurs wilayas ont annoncé des programmes d'installation de bornes de recharge rapide sur les axes autoroutiers. Alger et Oran sont en tête de ce déploiement.

## Ce qu'il faut surveiller

La réglementation concernant l'importation des véhicules électriques devrait évoluer dans les prochains mois. Restez informé sur Souq Autos.`,
    contentAr: `## انطلاقة حذرة

لا يزال المركبات الكهربائية تجد صعوبة في فرض نفسها على السوق الجزائري. تبقى حصته السوقية هامشية، بسبب غياب البنية التحتية للشحن والغموض حول أسعار قطع الغيار.

## المبادرات الجارية

أعلنت عدة ولايات عن برامج لتركيب محطات شحن سريع على الطرق السريعة. تتصدر الجزائر ووهران هذا الانتشار.

## ما يجب مراقبته

من المتوقع أن تتطور اللوائح المتعلقة باستيراد السيارات الكهربائية في الأشهر القادمة. ابقَ مطلعًا عبر سوق أوتو.`,
    publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    slug: `${SEED_TAG}-vendre-annonce-efficace`,
    titleFr: "Comment rédiger une annonce qui vend vraiment ?",
    titleAr: "كيف تكتب إعلانًا يبيع فعلاً؟",
    excerptFr: "Titre accrocheur, photos soignées, prix juste : nos conseils pour mettre toutes les chances de votre côté.",
    excerptAr: "عنوان جذاب، صور احترافية، سعر عادل: نصائحنا لتضع كل الحظوظ في صفك.",
    contentFr: `## Le titre : votre première impression

Évitez les titres vagues comme « Voiture à vendre ». Précisez la marque, le modèle, l'année et un point fort : « Renault Clio 2019 – Diesel – Faible kilométrage ».

## Les photos font la différence

Prenez au moins 8 photos : extérieur (4 angles), intérieur, tableau de bord, coffre et moteur. Choisissez un fond neutre et une bonne lumière naturelle.

## Fixez le bon prix

Consultez les annonces similaires sur Souq Autos et tenez compte de l'état réel du véhicule. Un prix trop élevé allongera inutilement la durée de vente.`,
    contentAr: `## العنوان: انطباعك الأول

تجنب العناوين المبهمة مثل "سيارة للبيع". حدّد الماركة والطراز والسنة وميزة رئيسية: "رينو كليو 2019 – ديزل – كيلومترية منخفضة".

## الصور تُحدث الفارق

التقط ما لا يقل عن 8 صور: الخارج (4 زوايا)، الداخل، لوحة القيادة، الصندوق والمحرك. اختر خلفية محايدة وإضاءة طبيعية جيدة.

## حدّد السعر المناسب

راجع الإعلانات المماثلة على سوق أوتو وخذ بعين الاعتبار الحالة الفعلية للمركبة. السعر المرتفع جداً سيطيل مدة البيع دون داعٍ.`,
    publishedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
  },
  {
    slug: `${SEED_TAG}-controle-technique-guide`,
    titleFr: "Contrôle technique : tout ce que vous devez savoir",
    titleAr: "الفحص التقني: كل ما تحتاج معرفته",
    excerptFr: "Fréquence, points contrôlés, centres agréés : le guide complet du contrôle technique en Algérie.",
    excerptAr: "الترددية، نقاط الفحص، المراكز المعتمدة: الدليل الكامل للفحص التقني في الجزائر.",
    contentFr: `## Pourquoi le contrôle technique est obligatoire

Le contrôle technique vise à garantir la sécurité des usagers de la route. En Algérie, il est obligatoire pour tous les véhicules de plus de 5 ans.

## Les points contrôlés

Les techniciens vérifient notamment : freins, direction, éclairage, pneumatiques, émissions polluantes et état général de la carrosserie.

## Préparer son véhicule

Assurez-vous que tous les feux fonctionnent, que les pneus sont en bon état et que le niveau des fluides est correct avant de vous rendre au centre.`,
    contentAr: `## لماذا الفحص التقني إلزامي

يهدف الفحص التقني إلى ضمان سلامة مستخدمي الطريق. في الجزائر، هو إلزامي لجميع المركبات التي تجاوزت 5 سنوات.

## نقاط الفحص

يتحقق التقنيون من: الفرامل، التوجيه، الإضاءة، الإطارات، الانبعاثات الملوثة والحالة العامة للهيكل.

## تجهيز مركبتك

تأكد من أن جميع الأضواء تعمل، وأن الإطارات في حالة جيدة، وأن مستوى السوائل صحيح قبل التوجه إلى المركز.`,
    publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    slug: `${SEED_TAG}-assurance-auto-choisir`,
    titleFr: "Bien choisir son assurance automobile en Algérie",
    titleAr: "كيف تختار تأمين سيارتك بشكل صحيح في الجزائر",
    excerptFr: "Au tiers ou tous risques ? Que couvrent réellement les contrats ? On fait le point pour vous aider à décider.",
    excerptAr: "ضد الغير أم شامل؟ ما الذي تُغطيه العقود فعلاً؟ نوضح الأمور لمساعدتك على اتخاذ القرار.",
    contentFr: `## Les deux grandes formules

**Assurance au tiers** : couvre les dommages que vous causez à autrui. Obligatoire, c'est le minimum légal. Adaptée aux véhicules anciens de faible valeur.

**Tous risques** : couvre en plus vos propres dommages, même si vous êtes responsable. Recommandée pour les véhicules récents ou de valeur.

## Comparer les offres

Ne vous contentez pas du prix : vérifiez les plafonds d'indemnisation, les exclusions, le réseau de garages agréés et la réactivité du service sinistre.

## Documents à conserver

Gardez toujours votre attestation d'assurance à portée de main dans le véhicule. En cas de contrôle ou d'accident, elle est exigée.`,
    contentAr: `## الصيغتان الكبريان

**التأمين ضد الغير**: يُغطّي الأضرار التي تُلحقها بالآخرين. إلزامي وهو الحد القانوني الأدنى. مناسب للمركبات القديمة ذات القيمة المنخفضة.

**التأمين الشامل**: يُغطّي أيضاً أضرارك الخاصة، حتى لو كنت المسؤول. مُوصى به للمركبات الحديثة أو ذات القيمة العالية.

## مقارنة العروض

لا تكتفِ بالسعر: تحقق من سقوف التعويض، والاستثناءات، وشبكة مرآب المعتمدة، وسرعة الاستجابة لخدمة الحوادث.

## الوثائق التي يجب الاحتفاظ بها

احتفظ دائماً بشهادة التأمين في متناولك داخل المركبة. عند المراقبة أو وقوع حادث، يُطلب تقديمها.`,
    publishedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) {
    throw new Error("Aucun compte ADMIN trouvé — lancez d'abord `npm run db:seed`.");
  }

  const deleted = await prisma.blogArticle.deleteMany({
    where: { slug: { startsWith: SEED_TAG } },
  });
  if (deleted.count > 0) console.log(`Articles précédents supprimés : ${deleted.count}`);

  for (const article of ARTICLES) {
    await prisma.blogArticle.create({
      data: {
        ...article,
        kind: "ARTICLE",
        authorId: admin.id,
        updatedAt: article.publishedAt,
      },
    });
  }

  console.log(`${ARTICLES.length} articles de démo créés.`);
  console.log("Visible sur : /fr/mag");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
