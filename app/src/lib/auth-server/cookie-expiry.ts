import { cookies } from "next/headers";

// Efface un cookie d'authentification (session, rafraîchissement, attente de la double authentification).
//
// `store.delete(nom)` n'émet PAS l'attribut Secure. Or en production ces cookies portent le préfixe `__Host-`, et un
// navigateur REFUSE tout Set-Cookie « __Host- » sans Secure, y compris celui qui sert à l'effacer : le cookie restait en place
// jusqu'à son expiration (constaté par l'e2e de production : le cookie d'attente 2FA subsistait après la vérification).
// On réémet donc le cookie, vide, avec les MÊMES attributs que lors de sa pose, et une durée de vie nulle.
export async function expireAuthCookie(name: string): Promise<void> {
  const store = await cookies();
  store.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
