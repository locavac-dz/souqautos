// Lot 111 — photo de couverture d'un essai.
//
// L'administrateur envoie l'image par un point d'entrée dédié
// (`/api/admin/blog/cover`), qui la revalide, la recadre et renvoie son adresse ;
// le formulaire ne fait ensuite que transmettre cette adresse avec l'article.
// Ce contrôle garantit que l'adresse enregistrée désigne bien un fichier produit
// par ce point d'entrée : jamais une URL externe (suivi de lecteurs, contenu
// modifiable après coup) ni un autre fichier du stockage (logo, photo d'annonce,
// pièce jointe de messagerie) qu'on ferait ensuite supprimer par erreur.

const COVER_DIR = "blog-covers";
const COVER_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

// `s3PublicUrl` : la valeur de S3_PUBLIC_URL (ou vide). Passée en argument pour
// garder la fonction pure et testable.
export function isBlogCoverUrl(url: string, s3PublicUrl: string | undefined): boolean {
  const local = `/uploads/${COVER_DIR}/`;
  if (url.startsWith(local)) return COVER_FILE.test(url.slice(local.length));

  const base = (s3PublicUrl ?? "").replace(/\/$/, "");
  if (base) {
    const remote = `${base}/${COVER_DIR}/`;
    if (url.startsWith(remote)) return COVER_FILE.test(url.slice(remote.length));
  }
  return false;
}
