import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push-send";
import type { PushPayload } from "@/lib/push";

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

    const payload: PushPayload = {
      title: proAccount.nomCommercial,
      body: listing.title,
      url: `/fr/annonce/${listing.id}`,
      tag: `new-listing-${listing.id}`,
    };

    await Promise.all(
      proAccount.followers.map(({ userId }) => sendPushToUser(userId, payload))
    );
  } catch (error) {
    console.error(`[pro-follow] notification échouée : ${(error as Error).message}`);
  }
}
