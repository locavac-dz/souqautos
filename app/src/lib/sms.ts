// Envoi SMS via Twilio REST API (aucun SDK — un seul fetch).
// Variables d'environnement requises en production :
//   TWILIO_ACCOUNT_SID  — Account SID (commence par "AC")
//   TWILIO_AUTH_TOKEN   — Auth Token
//   TWILIO_FROM_NUMBER  — numéro expéditeur au format E.164, ex. "+12015551234"
//
// En développement (NODE_ENV != "production"), le message est uniquement loggué.
//
// Lot 265 (audit 2026-10-08, constat A5) — la fonction dit désormais si le message est PARTI (`true`) ou non
// (`false` : variables manquantes, refus ou panne Twilio) : l'appelant peut répondre une erreur au lieu de
// « code envoyé ». `npm run launch:check` refuse par ailleurs une production sans TWILIO_*. Les journaux ne
// contiennent jamais le contenu du message (code OTP) ni le numéro complet (constat B8).
const REQUEST_TIMEOUT_MS = 10_000;

function maskPhone(to: string): string {
  return to.length > 4 ? `${to.slice(0, 4)}…${to.slice(-2)}` : "…";
}

export async function sendSms({ to, message }: { to: string; message: string }): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV SMS] À ${to} : ${message}`);
    return true;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.error("[SMS] Variables TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER manquantes — message non délivré");
    return false;
  }

  const body = new URLSearchParams({ From: from, To: to, Body: message });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[SMS] Twilio erreur HTTP ${res.status} — message non délivré à ${maskPhone(to)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[SMS] Twilio injoignable — message non délivré à ${maskPhone(to)} : ${(err as Error).name}`);
    return false;
  }
}
