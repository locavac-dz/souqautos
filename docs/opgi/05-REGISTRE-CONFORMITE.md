# 05 — Registre de conformité algérienne

> **Aucune règle ci-dessous n'est confirmée.** Tout est **« À valider »** à partir des **textes
> officiels et versions consolidées** en vigueur au moment de la vérification, par l'OPGI, INGÉNICA
> CIVIL et leurs conseils compétents. Ce registre liste les **sujets à vérifier**, pas des
> obligations établies. Une règle non confirmée ne doit **jamais** devenir une affirmation produit :
> elle reste « À valider » et déclenche une demande de validation compétente.

## Méthode (à remplir lors de chaque vérification)

Pour chaque sujet : **texte/exigence potentiellement applicable · source officielle · date de
vérification · responsable de validation · impact produit · décision · preuve**.

## Registre

| # | Sujet à vérifier | Pourquoi c'est pertinent | Statut | Responsable |
|---|---|---|---|---|
| C1 | Législation données personnelles (loi n° 18‑07 et modifications éventuelles) | Occupants, contacts, pièces d'identité | À valider | Conseil + DPO OPGI |
| C2 | Formalités / déclarations préalables aux traitements | Mise en conformité du traitement | À valider | Conseil |
| C3 | Droits des personnes (accès, rectification, opposition…) | Fonctions produit à prévoir | À valider | Conseil |
| C4 | Mesures de sécurité exigées | Chiffrement, audit, accès | À valider | Conseil + sécurité |
| C5 | Durées de conservation et purge | Paramétrage rétention (H17) | À valider | Conseil + OPGI |
| C6 | Transfert / hébergement / localisation des données | Mode centralisé, cloud (H18) | À valider | Conseil + OPGI |
| C7 | Règles propres aux organismes publics | OPGI = organisme public | À valider | OPGI |
| C8 | Documents et signatures électroniques | Si signature envisagée (H19) | À valider | Conseil |
| C9 | Marchés publics et dossiers de travaux | Module B (**suivi**, pas passation) | À valider | OPGI + conseil |
| C10 | Comptabilité, fiscalité, archives | États, pièces, exports | À valider | OPGI + finance |
| C11 | Référentiels sécurité / interopérabilité / accessibilité / hébergement imposés | Exigences autorité/OPGI | À valider | OPGI |
| C12 | Exigences contractuelles, sous-traitance, licences, propriété des données | Contrat INGÉNICA ↔ OPGI | À valider | Juridique INGÉNICA |

## Règles produit découlant du principe de prudence

1. Le module B est un outil de **suivi**, jamais une plateforme officielle de passation des marchés.
2. Aucune **décision d'approbation** n'est automatisée sans validation explicite des délégations et
   circuits de l'organisme.
3. Aucun **document généré** n'est présenté comme ayant une valeur juridique sans validation (H22) ;
   les modèles portent une mention « modèle à valider ».
4. Aucune **durée de conservation** n'est codée en dur (H17) ; purge configurable, activée après C5.
5. L'**hébergement centralisé** et la **localisation** ne sont pas présumés autorisés (C6, H18) :
   vérifications préalables à la mise en production.
6. Les **journaux d'audit** minimisent les données personnelles consignées (prudence C1/C4).

> Tant que C1–C12 ne sont pas tranchés, la plateforme fonctionne avec des **valeurs provisoires
> configurables** et des **données de démonstration fictives** clairement signalées ; aucune donnée
> réelle de production n'est traitée avant les validations nécessaires.
