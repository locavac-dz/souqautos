import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import {
  MAX_SUBSCRIPTIONS_PER_USER,
  buildPushPayload,
  isAllowedPushEndpoint,
  resolvePushConfig,
  type PushPayload,
} from "@/lib/push";

// Lot 121 — envoi d'une notification à TOUS les appareils d'un utilisateur.

export type PushSendResult = { sent: number; removed: number; failed: number };

// Durée pendant laquelle le service de notification garde le message si l'appareil est éteint ou
// hors connexion : 24 h. Une alerte plus ancienne n'a plus d'intérêt.
const TTL_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 8000;

// Pour les journaux : jamais l'adresse complète, qui contient l'identifiant secret de l'appareil.
function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "adresse invalide";
  }
}

// Ne lève JAMAIS d'exception : une notification qui échoue ne doit affecter ni l'envoi de
// l'email d'alerte qui l'accompagne ni les autres alertes. Sans clés VAPID, ne fait rien.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, removed: 0, failed: 0 };

  try {
    const config = resolvePushConfig(process.env);
    if (config.mode !== "enabled") return result;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_SUBSCRIPTIONS_PER_USER,
    });
    if (subscriptions.length === 0) return result;

    const body = JSON.stringify(buildPushPayload(payload));
    const options = {
      vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      TTL: TTL_SECONDS,
      urgency: "normal" as const,
      timeout: TIMEOUT_MS,
    };

    await Promise.all(
      subscriptions.map(async (subscription) => {
        const remove = async () => {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          result.removed += 1;
        };

        // Défense en profondeur : une ligne enregistrée avant l'ajout du contrôle, ou modifiée à la
        // main, ne doit jamais faire viser une adresse non reconnue.
        if (!isAllowedPushEndpoint(subscription.endpoint)) {
          await remove();
          return;
        }

        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            body,
            options
          );
          result.sent += 1;
          await prisma.pushSubscription
            .update({ where: { id: subscription.id }, data: { lastSentAt: new Date() } })
            .catch(() => undefined);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // L'appareil s'est désabonné, ou l'application a été désinstallée : on oublie l'abonnement.
            await remove();
          } else {
            result.failed += 1;
            console.error(`[push] échec d'envoi (${hostOf(subscription.endpoint)}) : ${status ?? (error as Error).message}`);
          }
        }
      })
    );
  } catch (error) {
    console.error(`[push] ${(error as Error).message}`);
  }

  return result;
}
