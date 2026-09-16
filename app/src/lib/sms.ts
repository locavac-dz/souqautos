// Aucun fournisseur SMS réel configuré (Twilio, AWS SNS, ou une passerelle DZ) —
// contrairement à l'email, il n'existe pas d'équivalent gratuit et testable
// (type Ethereal) pour le SMS sans compte payant. Le message est donc
// seulement journalisé côté serveur en développement. À remplacer par un vrai
// fournisseur avant toute mise en production ; interface volontairement
// minimale pour rester substituable (même esprit que PaymentProvider, §11).
//
// Le message peut contenir un code de vérification en clair (Lot 98,
// audit sécurité) : jamais journalisé tel quel hors développement — en
// production sans fournisseur réel configuré, le SMS n'est simplement pas
// délivré (limitation honnête, même discipline que l'IA/le paiement sans
// identifiants), plutôt que de fuiter le code dans les journaux serveur.
export async function sendSms({ to, message }: { to: string; message: string }): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV SMS] À ${to} : ${message}`);
    return;
  }
  console.error(`[SMS] Aucun fournisseur configuré, message non délivré à ${to}`);
}
