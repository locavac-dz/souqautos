// Changer de numéro de téléphone invalide la vérification précédente : elle
// prouvait la possession de l'ancien numéro, pas du nouveau. Retirer un
// numéro (null) invalide aussi la vérification, pour la même raison.
export function shouldResetPhoneVerification({
  oldPhone,
  newPhone,
}: {
  oldPhone: string | null;
  newPhone: string | null;
}): boolean {
  return oldPhone !== newPhone;
}
