// Envoi SMS via Twilio REST API (aucun SDK — un seul fetch).
// Variables d'environnement requises en production :
//   TWILIO_ACCOUNT_SID  — Account SID (commence par "AC")
//   TWILIO_AUTH_TOKEN   — Auth Token
//   TWILIO_FROM_NUMBER  — numéro expéditeur au format E.164, ex. "+12015551234"
//
// En développement (NODE_ENV != "production"), le message est uniquement loggué.
// Si les variables manquent en production, l'envoi échoue et une erreur est loggée
// sans fuiter le contenu du message (code OTP) dans les journaux.
export async function sendSms({ to, message }: { to: string; message: string }): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV SMS] À ${to} : ${message}`);
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.error("[SMS] Variables TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER manquantes — message non délivré");
    return;
  }

  const body = new URLSearchParams({ From: from, To: to, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[SMS] Twilio erreur ${res.status} — message non délivré à ${to} : ${detail}`);
  }
}
