// Format algérien : 0[5-7]XXXXXXXX (mobile) ou +213[5-7]XXXXXXXX — partagé
// entre l'assistant de publication (Lot 2) et l'édition de profil (Lot 20).
export const algerianPhoneRegex = /^(0[5-7]\d{8}|\+213[5-7]\d{8})$/;
