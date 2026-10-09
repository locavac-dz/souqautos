import { PageSkeleton } from "@/components/PageSkeleton";

// Lot 269 (audit D6) — retour visuel immédiat pendant la lecture en base.
export default function Loading() {
  return <PageSkeleton variant="article" />;
}
