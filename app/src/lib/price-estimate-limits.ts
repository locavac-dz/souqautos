// Limite de débit de l'estimation de prix (étape 5 de l'assistant de publication).
//
// Volontairement HORS de src/lib/price-estimate-action.ts : un fichier « use server » ne peut exporter que des
// fonctions asynchrones (Next.js lève « A "use server" file can only export async functions, found object » au
// chargement du module, ce qui cassait toute l'étape 5).
export const PRICE_ESTIMATE_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };
