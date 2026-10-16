# Plateforme intégrée de gestion des OPGI — Dossier de cadrage (Phase 0)

**Propriété : INGÉNICA CIVIL EURL** — famille de marques : AL HANDASSA, LOCAVAC, SOUQONLINE, SOUQ AUTO.
**Produit : plateforme multi‑OPGI** (Offices de Promotion et de Gestion Immobilière, Algérie).
**Date de rédaction : 2026-10-16.** **Branche : `claude/plateforme-opgi-algeriens-pryzm4`.**

> **Document de cadrage — aucun code produit.** Il répond au point 16 du prompt maître
> (« Première réponse attendue »). Il décrit l'état du dépôt, l'architecture proposée, les
> questions bloquantes, les hypothèses provisoires et le plan par phases. **Aucun développement
> de la plateforme OPGI ne démarre avant validation explicite de la décision d'architecture
> §01 (emplacement + modèle d'isolation) par le porteur du projet.**

Ce dossier suit la même discipline que `docs/ARCHITECTURE.md` du produit SOUQ AUTO (un « Lot 0 »
de cadrage rédigé avant le premier lot de code).

## Sommaire

| Fichier | Contenu | Point du prompt maître |
|---|---|---|
| [00-VISION-PERIMETRE.md](00-VISION-PERIMETRE.md) | Vision produit, périmètre des modules A/B/C, personas, glossaire | §6, §13 |
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | État du dépôt, décisions d'architecture, deux modes de déploiement | §3, §5, §16 |
| [02-ISOLATION-MULTI-OPGI.md](02-ISOLATION-MULTI-OPGI.md) | Stratégie d'isolation, analyse des menaces, plan de tests d'isolation | §2, §5, §9, §12 |
| [03-MATRICE-ROLES-PERMISSIONS.md](03-MATRICE-ROLES-PERMISSIONS.md) | Rôles × modules × actions × périmètre | §4 |
| [04-REGISTRE-HYPOTHESES.md](04-REGISTRE-HYPOTHESES.md) | Hypothèses provisoires et questions ouvertes | §3, §16 |
| [05-REGISTRE-CONFORMITE.md](05-REGISTRE-CONFORMITE.md) | Registre de conformité algérienne — tout « À valider » | §7, §10 |
| [06-PLAN-PHASES.md](06-PLAN-PHASES.md) | Plan par phases, incréments démontrables, critères d'acceptation | §12, §14 |

## Statut

- **Phase 0 (cadrage) : en cours.** Ce dossier en est le livrable.
- **Décision bloquante ouverte :** emplacement du code et modèle d'isolation multi‑OPGI (voir §01).
- **Prochaine étape :** après validation de la décision §01, démarrage de la Phase 1 (socle
  plateforme + démonstration d'isolation entre deux OPGI, **avant** toute donnée métier sensible).

## Avertissement juridique

Aucune règle juridique, obligation d'hébergement, durée de conservation, norme technique ou
procédure de marché public n'est présentée ici comme confirmée. Les points de droit figurent dans
[05-REGISTRE-CONFORMITE.md](05-REGISTRE-CONFORMITE.md), tous marqués « À valider » par l'OPGI,
INGÉNICA CIVIL et leurs conseils compétents.
