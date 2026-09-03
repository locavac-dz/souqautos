export type SuspensionEligibility =
  | { ok: true }
  | { ok: false; error: "cannot_suspend_self" | "cannot_suspend_staff" };

// Une suspension (manuelle depuis le back-office ou automatique après seuil
// de signalements confirmés, cf. reports.ts) ne peut jamais viser son propre
// compte ni un compte MODERATEUR/ADMIN — un membre du staff ne peut pas être
// mis hors service par un autre membre du staff via ce mécanisme (protection
// contre l'abus, même esprit que "cannot_change_own_role" sur les rôles).
export function checkCanSuspendUser({
  isSelf,
  targetIsStaff,
}: {
  isSelf: boolean;
  targetIsStaff: boolean;
}): SuspensionEligibility {
  if (isSelf) return { ok: false, error: "cannot_suspend_self" };
  if (targetIsStaff) return { ok: false, error: "cannot_suspend_staff" };
  return { ok: true };
}
