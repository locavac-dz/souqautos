import { starsFromRating } from "@/lib/road-test";

const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

function Star({ fill, size }: { fill: "full" | "half" | "empty"; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={STAR_PATH} fill="#e2e8f0" />
      {fill === "full" && <path d={STAR_PATH} fill="#f59e0b" />}
      {/* Demi-étoile : la moitié du côté de départ de la lecture est remplie
          (gauche en français, droite en arabe). Pas d'identifiant de clipPath :
          plusieurs notes peuvent figurer sur la même page. */}
      {fill === "half" && (
        <path
          d={STAR_PATH}
          fill="#f59e0b"
          className="[clip-path:inset(0_50%_0_0)] rtl:[clip-path:inset(0_0_0_50%)]"
        />
      )}
    </svg>
  );
}

// Lot 110 — note d'un essai en étoiles (demi-étoile incluse). Le libellé
// accessible est fourni par l'appelant (traduit), les étoiles elles-mêmes sont
// décoratives.
export function StarRating({ rating, label, size = 20 }: { rating: number; label: string; size?: number }) {
  const { full, half, empty } = starsFromRating(rating);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: full }, (_, i) => (
        <Star key={`f${i}`} fill="full" size={size} />
      ))}
      {half && <Star fill="half" size={size} />}
      {Array.from({ length: empty }, (_, i) => (
        <Star key={`e${i}`} fill="empty" size={size} />
      ))}
    </span>
  );
}
