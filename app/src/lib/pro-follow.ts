import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";

// Lot 161 — notifie tous les abonnés d'un compte pro quand une nouvelle annonce est publiée.
// Ne lève jamais d'exception : un échec de notification ne doit pas bloquer la modération.
export async function notifyProFollowers(listing: {
  id: string;
  title: string;
  sellerId: string;
}): Promise<void> {
  try {
    const proAccount = await prisma.professionalAccount.findUnique({
      where: { userId: listing.sellerId },
      select: {
        nomCommercial: true,
        followers: { select: { userId: true } },
      },
    });
    if (!proAccount || proAccount.followers.length === 0) return;

    // Lot 271 — push + notification in-app par abonné en un appel (notifyUser).
    await Promise.all(
      proAccount.followers.map(({ userId }) =>
        notifyUser({
          userId,
          kind: "PRO_FOLLOWER_LISTING",
          url: `/fr/annonce/${listing.id}`,
          body: listing.title,
          title: proAccount.nomCommercial,
          push: { title: proAccount.nomCommercial, body: listing.title, tag: `new-listing-${listing.id}` },
        })
      )
    );
  } catch (error) {
    console.error(`[pro-follow] notification échouée : ${(error as Error).message}`);
  }
}
