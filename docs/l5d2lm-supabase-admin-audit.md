# Audit phase 0 — administration L5D2LM avec Supabase

Date : 2026-09-18

## Objectif

Faire évoluer le site existant Les 5 doigts de la main sans le reconstruire à zéro, afin de rendre les contenus, les photos, les catégories et les cartes postales administrables depuis une interface privée `/gestion`.

La migration doit rester progressive : le site public existant continue de fonctionner pendant la mise en place de l’administration.

## Décision Supabase

Décision du 2026-09-19 : créer un nouveau projet Supabase dédié à L5D2LM plutôt que d’utiliser le projet Mission Déclic.

Cette décision réduit le risque de collision avec Mission Déclic et simplifie la sécurité. Les objets restent malgré tout préfixés `l5d2lm_` pour garder une séparation claire.

Projet L5D2LM :

`https://gopiicysitdcmxebdiwb.supabase.co`

## Dépôt inspecté

Chemin local :

`/Users/macdedepanne/Documents/l5d2lm/code l5d2lm github/l5d2lm-site-github/`

Dépôt Git :

`https://github.com/toopil/l5d2lm-site.git`

Branche :

`main`

État observé :

- dépôt propre côté fichiers suivis ;
- fichiers non suivis locaux : `.DS_Store`, `.codegraph/` ;
- aucun fichier `.env` ou secret Supabase trouvé ;
- aucune connexion Supabase existante trouvée dans le code.

## Architecture actuelle

Le site est un site statique publié via GitHub Pages.

Il n’y a pas de framework, pas de bundler, pas de dépendance JavaScript installée.

Le dépôt contient cependant un petit système local de génération :

- `content/` : contenus principaux des pages ;
- `_partials/` : éléments partagés du site ;
- `build/pages.py` : liste des pages, titres, descriptions, URL publiques ;
- `build/build.py` : génère les fichiers `l5d2lm-*.html` et `sitemap.xml`.

Les fichiers générés sont ensuite committés et publiés tels quels sur GitHub Pages.

## Pages publiques observées

Pages principales générées :

- `l5d2lm-index.html`
- `l5d2lm-massage-intuitif-reveil-energetique.html`
- `l5d2lm-corps-expression.html`
- `l5d2lm-colos-sejours.html`
- `l5d2lm-animations-participatives.html`
- `l5d2lm-espaces-a-decouvrir.html`
- `l5d2lm-contact.html`
- `l5d2lm-mentions-legales.html`

Page particulière :

- `l5d2lm-mission-declic.html` : page en construction avec `noindex`.

Pages de redirection sans préfixe :

- `index.html`
- `massage-intuitif-reveil-energetique.html`
- `corps-expression.html`
- `colos-sejours.html`
- `animations-participatives.html`
- `espaces-a-decouvrir.html`
- `contact.html`
- `mission-declic.html`

Ces redirections permettent de garder des URLs simples sans renommer les vrais fichiers préfixés.

## Mission Déclic

Dans ce dépôt, Mission Déclic apparaît seulement comme :

- une page locale en construction ;
- une redirection `mission-declic.html` vers `l5d2lm-mission-declic.html` ;
- une entrée `noindex` dans la configuration de génération.

Aucune table, clé, URL Supabase ou logique métier Mission Déclic n’a été trouvée dans ce code.

Règle à conserver :

- ne pas modifier Mission Déclic sans demande explicite ;
- ne jamais réutiliser des tables ou buckets Mission Déclic pour L5D2LM ;
- toutes les futures tables, fonctions et buckets L5D2LM doivent être préfixés `l5d2lm_`.

## Médias actuellement utilisés

Logos :

- `l5d2lm-logo-principal.png`
- `l5d2lm-logo-principal.webp`
- `l5d2lm-logo-massage-intuitif.png`
- `l5d2lm-logo-massage-intuitif.webp`
- `l5d2lm-logo-atelier-corps-expression.png`
- `l5d2lm-logo-atelier-corps-expression.webp`
- `l5d2lm-logo-colo.png`
- `l5d2lm-logo-colo.webp`
- `l5d2lm-logo-evenement-participatif.png`
- `l5d2lm-logo-evenement-participatif.webp`

Photos de cartes postales et contenus :

- `l5d2lm-photo-index.jpg`
- `l5d2lm-photo-index-2.jpg`
- `l5d2lm-photo-massage-intuitif.jpg`
- `l5d2lm-photo-massage-2.jpg`
- `l5d2lm-photo-massage-3.jpg`
- `l5d2lm-photo-massage-4.jpg`
- `l5d2lm-photo-corps-expression-2.jpg`
- `l5d2lm-photo-corps-expression-4.jpg`
- `l5d2lm-photo-corps-expression-jeux.jpg`
- `l5d2lm-photo-colo.jpg`
- `l5d2lm-photo-colo-2.jpg`
- `l5d2lm-photo-colo-3.jpg`
- `l5d2lm-photo-colo-4.jpg`
- `l5d2lm-photo-colo-5.jpg`
- `l5d2lm-photo-animation.jpg`
- `l5d2lm-photo-animation-2.jpg`
- `l5d2lm-photo-animation-3.jpg`
- `l5d2lm-photo-espaces.jpg`
- `l5d2lm-photo-espaces-2.jpg`
- `l5d2lm-photo-espaces-3.jpg`

Les logos utilisent déjà `<picture>` avec version `.webp`, dimensions explicites et fallback `.png`.

## Éléments à conserver

- Design public actuel.
- Pages HTML générées par le système existant.
- Fichiers préfixés `l5d2lm-*`.
- Redirections sans préfixe.
- Règles éditoriales actuelles.
- Page Mission Déclic en construction/noindex.
- Fonctionnement actuel du formulaire tant qu’un remplacement sécurisé n’est pas validé.
- Système `content/` + `_partials/` + `build/`, qui peut servir de base à une migration progressive.

## Ce qui doit migrer progressivement

Priorité progressive :

1. Les catégories/propositions et leur ordre.
2. Les photos et cartes postales.
3. Les textes structurés des pages.
4. Les réglages de visibilité.
5. Les brouillons, aperçus et publications.

Le site public doit d’abord garder son rendu statique existant, puis lire progressivement des données publiées depuis Supabase.

## Risques principaux

- Mélanger L5D2LM et Mission Déclic dans Supabase.
- Exposer des originaux privés ou non floutés publiquement.
- Croire que `/gestion` caché suffit à sécuriser l’administration.
- Mettre une clé secrète dans le frontend.
- Rendre visibles des brouillons ou photos à vérifier.
- Casser GitHub Pages en introduisant un build trop lourd.
- Refaire le design au lieu de préserver le site actuel.
- Ajouter une interface admin trop technique ou trop lourde sur mobile.

## Plan de migration proposé

### Phase 1 — Fondations sécurisées

Créer les objets Supabase dédiés L5D2LM :

- tables `l5d2lm_*` ;
- buckets Storage séparés ;
- policies RLS ;
- autorisation explicite via `l5d2lm_admins` ;
- exigence MFA/AAL2 pour l’administration ;
- tests SQL de sécurité.

### Phase 2 — Administration minimale `/gestion`

Ajouter une interface privée non liée dans la navigation publique.

Premiers écrans utiles :

- connexion ;
- vérification MFA ;
- tableau de bord simple ;
- médiathèque ;
- catégories ;
- cartes postales ;
- affichage du site ;
- corbeille.

### Phase 3 — Médiathèque

Importer plusieurs photos, créer des lots, gérer les catégories multiples, favoris, droits, alt, annotations, corbeille, usages, point focal et floutage manuel.

### Phase 4 — Contenus et visibilité

Migrer les textes structurés, statuts brouillon/publié, hiérarchie, ordre et sections masquées.

### Phase 5 — Cartes postales dynamiques

Configurer les cartes postales par proposition :

- photo unique par carte ;
- fixe, aléatoire ou semi-aléatoire ;
- rotation sans répétition ;
- remplacement au clic/tap ;
- swipe facultatif ;
- annotations par contexte.

### Phase 6 — Migration finale

Importer les médias existants, relier leurs usages actuels, vérifier l’absence de régression, puis retirer seulement ce qui est devenu inutile.

## Schéma de données proposé

Noms indicatifs, tous préfixés `l5d2lm_`.

- `l5d2lm_admins` : administrateurs autorisés.
- `l5d2lm_sections` : catégories/propositions hiérarchiques.
- `l5d2lm_collections` : collections d’origine des médias.
- `l5d2lm_upload_batches` : lots d’import.
- `l5d2lm_media` : métadonnées des fichiers.
- `l5d2lm_media_sections` : relation many-to-many média ↔ section.
- `l5d2lm_media_usages` : usages concrets d’un média, annotation override, rôle.
- `l5d2lm_postcard_configs` : configuration des cartes postales par section.
- `l5d2lm_text_blocks` : contenus textuels structurés.
- `l5d2lm_publication_snapshots` : version publiée consultée par le site public.
- `l5d2lm_admin_events` : journal d’administration.

Statuts recommandés :

- sections : `draft`, `published`, `hidden`;
- médias : `draft`, `published`, `archived`;
- droits : `authorized`, `faces_to_blur`, `needs_review`, `do_not_publish`;
- traitement : `pending`, `processing`, `ready`, `error`.

## Buckets Storage proposés

- `l5d2lm-private-originals` : originaux privés, jamais publics.
- `l5d2lm-public-media` : versions publiables seulement.
- `l5d2lm-admin-thumbnails` : miniatures admin, accessibles uniquement à l’admin si elles contiennent des médias non publiés.

Les noms exacts pourront être adaptés aux conventions Supabase existantes après inspection du projet réel.

## Variables d’environnement nécessaires

À prévoir sans jamais committer les valeurs :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur sécurisé, jamais côté navigateur.
- `L5D2LM_SITE_URL`
- variables propres aux Edge Functions si traitement d’images côté serveur.

## Points bloquants restants

- Finaliser et tester la page `/gestion` sur le site.
- Enrôler le MFA/TOTP du compte administrateur depuis `/gestion`.
- Transformer la checklist sécurité en tests automatisés.
- Décision sur le mode de traitement des images : Edge Function, service externe ou outil local d’import.

Ces éléments ne doivent pas être inventés.

## Prochaine étape recommandée

Créer une première migration SQL versionnée pour les fondations L5D2LM, sans l’appliquer automatiquement tant que le projet Supabase réel n’a pas été inspecté.

Puis créer une première page `/gestion` qui refuse proprement l’accès si Supabase n’est pas configuré, afin de préparer l’interface sans exposer de données.
