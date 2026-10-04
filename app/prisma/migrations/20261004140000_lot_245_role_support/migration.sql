-- Lot 245 — Rôle SUPPORT : modérateur de premier niveau (annonces, signalements,
-- avis, vérification d'identité). Périmètre plus restreint que MODERATEUR :
-- pas d'accès aux utilisateurs, statistiques, journal, paramètres ni comptes pro.
ALTER TYPE "Role" ADD VALUE 'SUPPORT';
