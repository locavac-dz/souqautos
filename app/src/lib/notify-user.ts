// Lot 271 (audit E1) — notifier une personne sur ses trois canaux en un appel.
//
// Le triplet « courriel (meilleur effort) + push + notification in-app » était recopié à chaque événement
// (offre reçue / acceptée / refusée / contre-offre, nouveau message, alerte de recherche, abonnés d'un pro).
// Ici : l'URL est commune aux canaux push et in-app (chemin du site, jamais une adresse extérieure), chaque
// canal est facultatif, et aucun échec ne lève — une notification ratée ne doit jamais faire échouer l'action
// qui l'a déclenchée (les trois fonctions sous-jacentes sont déjà « best effort » et journalisent).
import type { NotificationKind } from "@prisma/client";
import { sendEmailBestEffort } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push-send";
import { createNotification } from "@/lib/notification-service";

export type NotifyUserInput = {
  userId: string;
  kind: NotificationKind;
  // Chemin du site ouvert au clic (push et in-app), ex. `/fr/compte/offres`.
  url: string;
  // Texte court de la notification in-app (déjà traduit dans la langue du destinataire).
  body: string;
  title?: string;
  // Courriel, si l'événement en mérite un. `tag` = préfixe du journal `[EMAIL tag]`.
  email?: { to: string; subject: string; html: string; tag: string };
  // Notification push, si l'événement en mérite une.
  push?: { title: string; body: string; tag?: string; lang?: "fr" | "ar" };
};

export async function notifyUser(input: NotifyUserInput): Promise<void> {
  if (input.email) {
    await sendEmailBestEffort(input.email.tag, {
      to: input.email.to,
      subject: input.email.subject,
      html: input.email.html,
    });
  }
  if (input.push) {
    await sendPushToUser(input.userId, { ...input.push, url: input.url });
  }
  await createNotification(input.userId, input.kind, {
    url: input.url,
    body: input.body,
    ...(input.title ? { title: input.title } : {}),
  });
}
