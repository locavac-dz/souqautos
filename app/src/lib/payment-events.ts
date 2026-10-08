import type { PaymentEventSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProviderOrderKind } from "@/lib/payment-fulfillment";

// Lot 266 (audit B2) — trace de chaque décision de paiement, système ou humaine. Jamais bloquant : une trace
// qui échoue à s'écrire ne doit ni empêcher une activation ni faire rejouer un webhook.
export type PaymentEventInput = {
  orderKind: ProviderOrderKind;
  orderId: string;
  source: PaymentEventSource;
  outcome: string;
  providerEventId?: string | null;
  providerStatus?: string | null;
  amount?: number | null;
  currency?: string | null;
  actorUserId?: string | null;
};

export async function recordPaymentEvent(input: PaymentEventInput): Promise<void> {
  try {
    await prisma.paymentEvent.create({
      data: {
        orderKind: input.orderKind,
        orderId: input.orderId,
        source: input.source,
        outcome: input.outcome.slice(0, 80),
        providerEventId: input.providerEventId ?? null,
        providerStatus: input.providerStatus?.slice(0, 40) ?? null,
        amount: input.amount ?? null,
        currency: input.currency?.slice(0, 8) ?? null,
        actorUserId: input.actorUserId ?? null,
      },
    });
  } catch (err) {
    console.error(`[paiement] trace non écrite pour ${input.orderKind}/${input.orderId} : ${(err as Error).message}`);
  }
}
