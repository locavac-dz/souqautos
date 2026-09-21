import { expect, test } from "@playwright/test";
import { disconnectE2eDb, e2eDb } from "../e2e/db";
import { DEMO_SELLER_KARIM } from "../e2e/fixtures";
import fr from "../messages/fr.json";

// Lot 143 — sur la VERSION DE PRODUCTION (compilée, servie par `next start`), là où le cache de réactivité des cartes est ACTIF (le
// serveur de développement des tests de bout en bout le désactive pour lire les données en direct). Ce test prouve, sur le vrai
// serveur : (1) que la carte d'un résultat affiche le badge, (2) qu'elle le garde quand les conversations changent en base — c'est le
// cache, sans lui la mesure de charge de ce lot passait de 458 à 1 491 ms —, (3) que la fiche d'annonce, elle, lit toujours en direct.
test.afterAll(disconnectE2eDb);
test.setTimeout(90_000);

const T = fr.SellerTrust;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

test("les cartes de résultats mettent la réactivité en cache ; la fiche d'annonce la lit en direct", async ({ page }) => {
  const tag = `Voiture pwa-cache-${Date.now().toString(36)}`;
  const karim = await e2eDb().user.findUniqueOrThrow({ where: { email: DEMO_SELLER_KARIM.email }, select: { id: true } });
  const template = await e2eDb().listing.findFirstOrThrow({ where: { sellerId: karim.id, status: "PUBLIEE" } });

  // Un vendeur NEUF, que personne n'a encore vu : sinon un autre test aurait pu mettre « aucun badge » en cache pour lui.
  const seller = await e2eDb().user.create({ data: { email: `${tag.replace(/\s/g, "-")}@example.dz`, emailVerifiedAt: new Date() } });
  const { id: _templateId, ...columns } = template;
  void _templateId;
  const listing = await e2eDb().listing.create({ data: { ...columns, sellerId: seller.id, title: tag } });

  // Six conversations sur son annonce, toutes répondues en 10 minutes, il y a trois jours : de quoi mériter le badge.
  const buyers = await Promise.all(Array.from({ length: 6 }, (_, i) => e2eDb().user.create({ data: { email: `${tag.replace(/\s/g, "-")}-acheteur-${i}@example.dz`, emailVerifiedAt: new Date() } })));
  const asked = new Date(Date.now() - 3 * DAY);
  for (const buyer of buyers) {
    const conversation = await e2eDb().conversation.create({ data: { listingId: listing.id, buyerId: buyer.id, sellerId: seller.id, createdAt: asked } });
    await e2eDb().message.createMany({
      data: [
        { conversationId: conversation.id, senderId: buyer.id, content: "Bonjour, est-elle toujours disponible ?", createdAt: asked },
        { conversationId: conversation.id, senderId: seller.id, content: "Oui.", createdAt: new Date(asked.getTime() + 10 * 60_000) },
      ],
    });
  }

  try {
    const search = `/fr/recherche?q=${encodeURIComponent(tag)}`;
    const card = () => page.getByRole("link").filter({ hasText: tag });

    // (1) Première visite : la réactivité est lue en base, la carte affiche le badge.
    await page.goto(search);
    await expect(card().getByText(T.cardUnder1h)).toBeVisible();

    // Les réponses disparaissent de la base : lu en direct, ce vendeur n'aurait plus de badge du tout.
    await e2eDb().message.deleteMany({ where: { conversation: { sellerId: seller.id }, senderId: seller.id } });

    // (2) La carte GARDE le badge : la valeur vient du cache (5 minutes), la base n'est pas relue.
    await page.goto(search);
    await expect(card().getByText(T.cardUnder1h)).toBeVisible();

    // (3) La fiche d'annonce lit EN DIRECT : sans réponses, plus de badge — là où le vendeur, ou un acheteur décidé, regarde de près.
    await page.goto(`/fr/annonce/${listing.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(T.badgeUnder1h)).toHaveCount(0);
    await expect(page.getByText(T.badgeUnder2h)).toHaveCount(0);
  } finally {
    await e2eDb().conversation.deleteMany({ where: { sellerId: seller.id } });
    await e2eDb().listing.deleteMany({ where: { id: listing.id } });
    await e2eDb().user.deleteMany({ where: { id: { in: [seller.id, ...buyers.map((b) => b.id)] } } });
  }
});
