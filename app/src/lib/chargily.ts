import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Lot 264 — Chargily Pay (https://dev.chargily.com/pay-v2) : passerelle algérienne qui donne accès aux
// cartes CIB (SATIM) et Edahabia (Algérie Poste) sans contrat SATIM direct. Deuxième mode de paiement,
// à côté du virement manuel (Lot 66) qui reste le repli.
//
// Ce module ne fait AUCUN appel réseau sauf `createChargilyCheckout` et `retrieveChargilyCheckout` :
// le reste (configuration, signature des webhooks, lecture d'un événement) est pur et testé.
//
// Flux « checkout hébergé » :
//   1. le serveur crée un checkout (montant en DZD, adresses de retour, adresse du webhook) et reçoit
//      `checkout_url` ; le navigateur de l'acheteur y est envoyé ;
//   2. Chargily appelle POST /api/webhooks/chargily avec un en-tête `signature` = HMAC-SHA256 du corps
//      brut, clé = notre clé secrète ; on vérifie, puis on confirme la commande (src/lib/chargily-events.ts) ;
//   3. en secours (webhook perdu, ou serveur local injoignable depuis Internet), le vendeur peut demander
//      une relecture du statut chez Chargily (/api/payments/chargily/refresh) — même confirmation.
// L'URL de retour « succès » n'active JAMAIS rien : l'acheteur peut la forger ou ne jamais l'ouvrir.

type Env = Record<string, string | undefined>;

export const CHARGILY_TEST_BASE_URL = "https://pay.chargily.net/test/api/v2";
export const CHARGILY_LIVE_BASE_URL = "https://pay.chargily.net/api/v2";
export const CHARGILY_WEBHOOK_PATH = "/api/webhooks/chargily";
const REQUEST_TIMEOUT_MS = 10_000;

export type ChargilyMode = "test" | "live";
export type ChargilyConfig = { secretKey: string; baseUrl: string; mode: ChargilyMode };
export type ChargilyResolution =
  | { mode: "disabled" }
  | { mode: "error"; reason: string }
  | { mode: "enabled"; config: ChargilyConfig };

// Le mode (test / live) se déduit du préfixe de la clé secrète, jamais d'une variable séparée qui
// pourrait la contredire : une clé `test_sk_` ne peut encaisser qu'en bac à sable, une clé `live_sk_`
// qu'en production. En production, une clé de test est une erreur (aucun paiement réel ne serait
// encaissé alors que le site afficherait « payer en ligne »).
//
// `CHARGILY_API_BASE_URL` remplace l'adresse de Chargily par un faux serveur, POUR LES TESTS UNIQUEMENT :
// ignorée en production, quelle que soit la configuration (même principe que GOOGLE_OAUTH_TEST_BASE_URL).
export function resolveChargilyConfig(env: Env): ChargilyResolution {
  const secretKey = env.CHARGILY_SECRET_KEY?.trim();
  if (!secretKey) return { mode: "disabled" };

  let mode: ChargilyMode;
  if (secretKey.startsWith("test_sk_")) mode = "test";
  else if (secretKey.startsWith("live_sk_")) mode = "live";
  else return { mode: "error", reason: "CHARGILY_SECRET_KEY n'a pas la forme d'une clé secrète Chargily Pay (test_sk_… ou live_sk_…)." };

  const isProduction = env.NODE_ENV === "production";
  if (isProduction && mode === "test") {
    return { mode: "error", reason: "CHARGILY_SECRET_KEY est une clé de TEST (test_sk_…) : aucun paiement réel ne serait encaissé." };
  }

  const override = !isProduction ? env.CHARGILY_API_BASE_URL?.trim().replace(/\/$/, "") : undefined;
  const baseUrl = override || (mode === "test" ? CHARGILY_TEST_BASE_URL : CHARGILY_LIVE_BASE_URL);
  return { mode: "enabled", config: { secretKey, baseUrl, mode } };
}

// Vérification de la signature d'un webhook : HMAC-SHA256 hexadécimal du corps BRUT (tel que reçu,
// pas re-sérialisé : un espace de différence changerait l'empreinte), comparé à temps constant.
export function verifyChargilySignature(rawBody: string, signature: string | null | undefined, secretKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secretKey).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const CHARGILY_CHECKOUT_STATUSES = ["pending", "processing", "paid", "failed", "canceled", "expired"] as const;
export type ChargilyCheckoutStatus = (typeof CHARGILY_CHECKOUT_STATUSES)[number];

const checkoutSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    checkout_url: z.string().optional(),
  })
  .passthrough();

const eventSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().min(1),
    data: checkoutSchema,
  })
  .passthrough();

export type ChargilyCheckout = z.infer<typeof checkoutSchema>;
export type ChargilyEvent = z.infer<typeof eventSchema>;

// Un événement dont on ne connaît pas la forme est refusé (jamais interprété « au mieux ») ; un TYPE
// inconnu (ex. un futur `checkout.expired`) est accepté et simplement ignoré par le traitement.
export function parseChargilyEvent(payload: unknown): ChargilyEvent | null {
  const parsed = eventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export class ChargilyApiError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "ChargilyApiError";
  }
}

async function chargilyRequest(config: ChargilyConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      // Jamais le corps de la réponse dans l'erreur (il peut citer des données de l'acheteur, et finit dans les
      // journaux) : le code HTTP suffit (Lot 267, audit F3).
      throw new ChargilyApiError(`Chargily ${method} ${path} → HTTP ${response.status}`, response.status);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ChargilyApiError(`Chargily ${method} ${path} → réponse non JSON`, response.status);
    }
  } catch (err) {
    if (err instanceof ChargilyApiError) throw err;
    throw new ChargilyApiError(`Chargily ${method} ${path} → ${(err as Error).name === "AbortError" ? "délai dépassé" : (err as Error).message}`, null);
  } finally {
    clearTimeout(timer);
  }
}

export type CreateCheckoutInput = {
  amountDzd: number;
  successUrl: string;
  failureUrl: string;
  webhookEndpoint: string;
  description: string;
  locale: "fr" | "ar";
};

export type CreatedCheckout = { id: string; checkoutUrl: string };

// Montants en dinars entiers (`amount` Chargily = DZD, pas de centimes). Les frais Chargily restent à
// leur répartition par défaut côté prestataire ; on ne fixe pas `payment_method` : la page de paiement
// hébergée laisse l'acheteur choisir entre CIB et Edahabia.
export async function createChargilyCheckout(config: ChargilyConfig, input: CreateCheckoutInput): Promise<CreatedCheckout> {
  if (!Number.isInteger(input.amountDzd) || input.amountDzd <= 0) {
    throw new ChargilyApiError("montant invalide", null);
  }
  const json = await chargilyRequest(config, "POST", "/checkouts", {
    amount: input.amountDzd,
    currency: "dzd",
    success_url: input.successUrl,
    failure_url: input.failureUrl,
    webhook_endpoint: input.webhookEndpoint,
    description: input.description,
    locale: input.locale,
  });
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success || !parsed.data.checkout_url) {
    throw new ChargilyApiError("réponse de création de checkout incomplète (id / checkout_url)", null);
  }
  return { id: parsed.data.id, checkoutUrl: parsed.data.checkout_url };
}

export async function retrieveChargilyCheckout(config: ChargilyConfig, checkoutId: string): Promise<ChargilyCheckout> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(checkoutId)) throw new ChargilyApiError("identifiant de checkout invalide", null);
  const json = await chargilyRequest(config, "GET", `/checkouts/${checkoutId}`);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) throw new ChargilyApiError("réponse de relecture de checkout incomplète", null);
  return parsed.data;
}
