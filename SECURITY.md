# Politique de securite

## Signaler une vulnerabilite

Si vous decouvrez une faille de securite dans Souq Autos, merci de la signaler de maniere responsable.

**Ne publiez pas** la vulnerabilite dans une issue publique, un commentaire ou un forum.

Envoyez un email a : **security@souqautos.com**

Incluez dans votre rapport :

- Description de la vulnerabilite
- Etapes pour la reproduire
- Impact potentiel
- Correctif suggere (si applicable)

## Delai de reponse

- **Accuse de reception** : sous 48 heures
- **Evaluation initiale** : sous 7 jours
- **Correctif** : selon la severite (critique : sous 72h, majeur : sous 15 jours)

## Perimetre

| Dans le perimetre | Hors perimetre |
|-------------------|----------------|
| souqautos.com | Services tiers (Chargily, hebergeur) |
| API /api/* | Attaques par deni de service |
| Authentification et sessions | Ingenierie sociale |
| Donnees utilisateurs | Vulnerabilites deja signalees |

## Mesures en place

- Authentification JWT avec revocation individuelle (jti)
- Double authentification TOTP pour les comptes staff
- Middleware CSRF (validation Origin / Sec-Fetch-Site)
- Rate limiting sur les routes sensibles
- Content Security Policy (CSP)
- Verrouillage de compte apres tentatives echouees
- Validation des entrees (zod) sur toutes les routes mutatrices
- Journal d'audit pour les actions d'administration
- Analyse anti-fraude (score + IA)

## Divulgation responsable

Nous nous engageons a :

- Ne pas engager de poursuites contre les chercheurs qui respectent cette politique
- Collaborer pour comprendre et corriger la vulnerabilite
- Crediter le chercheur (sauf demande d'anonymat) dans le changelog du correctif
