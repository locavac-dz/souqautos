import { prisma } from "@/lib/prisma";
import { decryptBuffer, encryptBuffer } from "@/lib/crypto/at-rest";
import { verifyPassword } from "@/lib/auth-server/password";
import { sendEmail } from "@/lib/mailer";
import { writeAuditLog } from "@/lib/audit-log";
import { qrDrawing, type QrDrawing } from "@/lib/qr";
import { RECOVERY_CODE_COUNT, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "@/lib/recovery-codes";
import { formatSecretForDisplay, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { normalizeNoticeLocale, twoFactorNoticeEmail, type TwoFactorNoticeKind } from "@/lib/two-factor-emails";

// Lot 138 — double authentification (TOTP) : le déroulement, séparé des routes pour être testé sans réseau.
// Les règles de calcul (code, fenêtre, anti-rejeu) sont dans src/lib/totp.ts ; ici : la base, les courriels, le journal d'audit.

export const ISSUER = "Souq Autos";

const sealSecret = (secret: string) => encryptBuffer(Buffer.from(secret, "utf8")).toString("base64");
const openSecret = (sealed: string) => decryptBuffer(Buffer.from(sealed, "base64")).toString("utf8");

// Avertissement à la personne ; son échec ne doit jamais défaire ce qui vient d'être fait (le courriel est un filet, pas la règle).
async function notify(user: { email: string; locale: string }, kind: TwoFactorNoticeKind, remaining = 0) {
  try {
    await sendEmail({ to: user.email, ...twoFactorNoticeEmail(kind, normalizeNoticeLocale(user.locale), remaining) });
  } catch (error) {
    console.error(`[auth] Courriel de double authentification (${kind}) non envoyé : ${(error as Error).message}`);
  }
}

async function audit(userId: string, action: string, details?: Record<string, unknown>, adminId = userId) {
  try {
    await writeAuditLog({ adminId, action, targetType: "User", targetId: userId, ...(details ? { details } : {}) });
  } catch (error) {
    console.error(`[auth] Journal d'audit (${action}) non écrit : ${(error as Error).message}`);
  }
}

export async function getTwoFactorStatus(userId: string): Promise<{ enabled: boolean; enabledAt: Date | null; recoveryCodesRemaining: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } });
  const remaining = user?.totpEnabledAt ? await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } }) : 0;
  return { enabled: Boolean(user?.totpEnabledAt), enabledAt: user?.totpEnabledAt ?? null, recoveryCodesRemaining: remaining };
}

// --- Activation -----------------------------------------------------------------------------------------------------------------

export type BeginResult =
  | { ok: true; secret: string; secretDisplay: string; uri: string; qr: QrDrawing }
  | { ok: false; error: "already_enabled" | "not_found" | "invalid_password" };

// Étape 1 : un secret est tiré et MONTRÉ (code QR + clé à recopier). Il est gardé chiffré comme « en attente » : il ne protège
// rien tant que la personne n'a pas prouvé, à l'étape 2, qu'elle le lit dans son application. Recommencer remplace le secret en attente.
// Lot 229 — le mot de passe est exigé : une session volée ne doit pas pouvoir enrôler le téléphone de l'attaquant et verrouiller le
// titulaire dehors. Un compte créé avec Google, sans mot de passe, n'a que sa session (même règle que la désactivation).
export async function beginEnrolment(userId: string, password?: string): Promise<BeginResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, totpEnabledAt: true, passwordHash: true } });
  if (!user) return { ok: false, error: "not_found" };
  if (user.totpEnabledAt) return { ok: false, error: "already_enabled" };
  if (user.passwordHash && !(typeof password === "string" && (await verifyPassword(password, user.passwordHash)))) return { ok: false, error: "invalid_password" };

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecretEnc: sealSecret(secret) } });
  const uri = otpauthUri({ issuer: ISSUER, account: user.email, secret });
  return { ok: true, secret, secretDisplay: formatSecretForDisplay(secret), uri, qr: qrDrawing(uri) };
}

export type ConfirmResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: "no_pending" | "invalid_code" | "already_enabled" | "not_found" };

// Étape 2 : la personne saisit le code que lit son application. Tout se fait ensemble ou pas du tout :
//  - le secret en attente devient le secret du compte (comparé-et-remplacé : deux confirmations simultanées, une seule aboutit) ;
//  - le pas du code est mémorisé (il ne pourra pas être rejoué) ;
//  - les AUTRES sessions sont révoquées (un attaquant qui aurait déjà une session ne survit pas à l'activation) ;
//  - dix codes de secours sont créés, MONTRÉS UNE SEULE FOIS (seule leur empreinte est gardée).
export async function confirmEnrolment(userId: string, code: string, now: Date = new Date()): Promise<ConfirmResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, totpEnabledAt: true, totpPendingSecretEnc: true } });
  if (!user) return { ok: false, error: "not_found" };
  if (user.totpEnabledAt) return { ok: false, error: "already_enabled" };
  if (!user.totpPendingSecretEnc) return { ok: false, error: "no_pending" };

  const verification = verifyTotp(openSecret(user.totpPendingSecretEnc), code, { nowMs: now.getTime(), lastStep: null });
  if (!verification.ok) return { ok: false, error: "invalid_code" };

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  const activated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: userId, totpEnabledAt: null, totpPendingSecretEnc: user.totpPendingSecretEnc },
      data: { totpSecretEnc: user.totpPendingSecretEnc, totpPendingSecretEnc: null, totpEnabledAt: now, totpLastStep: verification.step, sessionsValidAfter: now },
    });
    if (claimed.count !== 1) return false;
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(normalizeRecoveryCode(c)!) })) });
    return true;
  });
  if (!activated) return { ok: false, error: "already_enabled" };

  await audit(userId, "two_factor.enable");
  await notify(user, "enabled");
  return { ok: true, recoveryCodes };
}

// --- Le second facteur (connexion, désactivation, nouveaux codes) --------------------------------------------------------------

export type ChallengeResult = { ok: true; method: "totp" | "recovery" } | { ok: false; error: "invalid_code" | "not_enabled" };

// Vérifie un code d'application OU un code de secours. Dans les deux cas la consommation est ATOMIQUE, décidée par la base :
//  - code de secours : « marqué utilisé si et seulement s'il ne l'était pas » (un seul des deux appels simultanés l'obtient) ;
//  - code d'application : le pas n'est accepté que s'il dépasse le dernier pas mémorisé, en une seule instruction SQL — sans cela,
//    deux requêtes envoyées ensemble avec le même code passeraient toutes les deux (le rejeu est fermé même à la milliseconde).
export async function challenge(userId: string, input: string, now: Date = new Date()): Promise<ChallengeResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true } });
  if (!user || !user.totpEnabledAt || !user.totpSecretEnc) return { ok: false, error: "not_enabled" };

  const recovery = normalizeRecoveryCode(input);
  if (recovery) {
    const used = await prisma.twoFactorRecoveryCode.updateMany({ where: { userId, codeHash: hashRecoveryCode(recovery), usedAt: null }, data: { usedAt: now } });
    if (used.count !== 1) return { ok: false, error: "invalid_code" };
    const remaining = await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
    await audit(userId, "two_factor.recovery_used", { remaining });
    await notify(user, "recovery_used", remaining);
    return { ok: true, method: "recovery" };
  }

  const verification = verifyTotp(openSecret(user.totpSecretEnc), input, { nowMs: now.getTime(), lastStep: user.totpLastStep });
  if (!verification.ok) return { ok: false, error: "invalid_code" };
  const claimed = await prisma.user.updateMany({
    where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: verification.step } }] },
    data: { totpLastStep: verification.step },
  });
  return claimed.count === 1 ? { ok: true, method: "totp" } : { ok: false, error: "invalid_code" };
}

export type DisableResult = { ok: true } | { ok: false; error: "not_enabled" | "invalid_password" | "invalid_code" };

// Désactiver exige les DEUX preuves : le mot de passe (une session volée ne suffit pas) ET un code. Un compte créé avec Google,
// sans mot de passe, n'a que le code.
export async function disableTwoFactor(userId: string, { password, code }: { password?: string; code: string }, now: Date = new Date()): Promise<DisableResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, passwordHash: true, totpEnabledAt: true } });
  if (!user || !user.totpEnabledAt) return { ok: false, error: "not_enabled" };
  if (user.passwordHash && !(typeof password === "string" && (await verifyPassword(password, user.passwordHash)))) return { ok: false, error: "invalid_password" };

  const second = await challenge(userId, code, now);
  if (!second.ok) return { ok: false, error: second.error === "not_enabled" ? "not_enabled" : "invalid_code" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await audit(userId, "two_factor.disable");
  await notify(user, "disabled");
  return { ok: true };
}

export type RegenerateResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: "not_enabled" | "invalid_code" };

// Nouveaux codes de secours : les anciens cessent de fonctionner. Exige un code (un code de secours convient : c'est le cas de
// la personne qui vient de perdre son téléphone).
export async function regenerateRecoveryCodes(userId: string, code: string, now: Date = new Date()): Promise<RegenerateResult> {
  const second = await challenge(userId, code, now);
  if (!second.ok) return { ok: false, error: second.error };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } });

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(normalizeRecoveryCode(c)!) })) }),
  ]);
  await audit(userId, "two_factor.recovery_regenerated");
  if (user) await notify(user, "recovery_regenerated");
  return { ok: true, recoveryCodes };
}

// --- Récupération par l'équipe -------------------------------------------------------------------------------------------------

// Une personne qui a perdu son téléphone ET ses codes de secours : un administrateur (ou la commande `npm run auth:reset-2fa`,
// pour l'unique administrateur qui serait lui-même bloqué) réinitialise la fonction. Les sessions du compte sont révoquées ;
// la personne est prévenue par courriel. L'administrateur qui agit est enregistré dans le journal d'audit.
export async function resetTwoFactor(userId: string, actorId: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; error: "not_enabled" | "not_found" }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, totpEnabledAt: true, totpPendingSecretEnc: true } });
  if (!user) return { ok: false, error: "not_found" };
  if (!user.totpEnabledAt && !user.totpPendingSecretEnc) return { ok: false, error: "not_enabled" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabledAt: null, totpLastStep: null, sessionsValidAfter: now } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await audit(userId, "two_factor.reset", { by: actorId === userId ? "commande" : "administrateur" }, actorId);
  await notify(user, "reset_by_admin");
  return { ok: true };
}
