# 03 — Matrice rôles / permissions

> Rôles **configurables**. Cette matrice est un **point de départ** à valider par l'OPGI pilote.
> Modèle d'autorisation : `permission = (organisme, module, action, périmètre)`. Principe du
> **moindre privilège**. Vérification **côté serveur** sur chaque requête, tâche, export, fichier.

## 1. Dimensions

- **Organisme** — un OPGI (ou plusieurs si et seulement si le modèle d'exploitation **et** une
  autorisation explicite le permettent).
- **Module** — A (locatif), B (projets/marchés), C (réclamations).
- **Action** — `lire`, `créer`, `modifier`, `valider`, `exporter`, `administrer`.
- **Périmètre** — sous-ensemble organisationnel (service, zone, projet) restreignant encore l'accès.

## 2. Matrice de départ (L=lire, C=créer, M=modifier, V=valider, E=exporter, A=administrer, —=aucun)

| Rôle | Portée organisme | Module A | Module B | Module C | Admin / Config | Audit |
|---|---|---|---|---|---|---|
| Admin **plateforme** | Tous | — | — | — | Création OPGI, technique | Technique |
| Admin **OPGI** | 1 OPGI | A (config) | A (config) | A (config) | Utilisateurs, modules, modèles | Métier (son OPGI) |
| Direction / resp. service | 1 OPGI, périmètre | L, E | L, E | L, E | — | L (son périmètre) |
| Agent gestion locative | 1 OPGI | L, C, M | — | L (lien bien) | — | — |
| Agent recouvrement / fin. | 1 OPGI | L, C, M, E (financier) | L (financier) | — | — | — |
| Chef de projet | 1 OPGI, projet | — | L, C, M | L | — | — |
| Gestionnaire marchés | 1 OPGI | — | L, C, M, V (situations) | — | — | — |
| Resp. réclamations/maint. | 1 OPGI | L (lien bien) | — | L, C, M, V | — | — |
| Technicien interne | 1 OPGI, affectations | — | — | L, M (ses OT) | — | — |
| Entreprise / prestataire | 1 OPGI, confié | — | L, C (ses situations) | L, M (ses interventions) | — | — |
| Locataire / occupant | — (portail) | L (ses données) | — | L, C (ses réclamations) | — | — |
| Auditeur / lecteur | 1 OPGI | L | L | L | — | L |

> Les cases « V » (valider) sont des **points de délégation** : aucun circuit d'approbation n'est
> automatisé sans validation explicite des délégations et règles de l'organisme (prompt §6, §B).

## 3. Exigences transverses

- **Séparation** stricte du rôle *admin plateforme* (technique, tous OPGI) et des *droits métier*
  (données d'un OPGI). Le rôle technique n'a **aucun** accès métier.
- **Affectation multi‑OPGI** possible uniquement si le modèle d'exploitation **et** l'autorisation
  le permettent.
- **Cycle de vie des accès** : suspension, révocation de sessions, réinitialisation sécurisée,
  **historique des changements d'habilitation** (journalisé, voir `02`/§audit).
- **Jamais** d'`organisationId` navigateur comme seule preuve d'autorisation (D3).
- **Entreprises et locataires** : accès strictement limité aux interventions/pièces/demandes qui
  les concernent.

## 4. Points à valider

- Libellés et découpage réels des services/périmètres de l'OPGI pilote.
- Qui détient « V » (validation) sur situations de travaux, réceptions, recouvrement — **délégations
  à valider**.
- Activation (ou non) du rôle *auditeur/lecteur* et du portail *locataire* selon l'OPGI.
- Politique d'authentification (longueur de session, 2FA obligatoire pour quels rôles) — **À valider**.
