// Aucun fournisseur SMS réel configuré (Twilio, AWS SNS, ou une passerelle DZ) —
// contrairement à l'email, il n'existe pas d'équivalent gratuit et testable
// (type Ethereal) pour le SMS sans compte payant. Le message est donc
// seulement journalisé côté serveur en développement. À remplacer par un vrai
// fournisseur avant toute mise en production ; interface volontairement
// minimale pour rester substituable (même esprit que PaymentProvider, §11).
export async function sendSms({ to, message }: { to: string; message: string }): Promise<void> {
  console.log(`[DEV SMS] À ${to} : ${message}`);
}
