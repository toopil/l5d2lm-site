# Les 5 doigts de la main — site vitrine V1

Ce dossier contient un site statique léger, responsive et pensé pour GitHub Pages. Il suit une structure simple qui pourra évoluer vers WordPress plus tard.

## Structure

- Pages HTML : accueil, massages, corps & expression, colo pour adultes, animation participative, Mission Déclic, espaces et contact
- CSS : styles réutilisables et responsive
- JavaScript : menu burger et micro-interactions légères
- Données : navigation, activités, espaces et formulaires en JSON

## Lancer localement

Ouvrez l’index.html dans un navigateur, ou lancez une simple commande de serveur local :

```bash
python3 -m http.server 8000
```

Puis ouvrez http://localhost:8000.

« À portée de main » fait partie de la page `corps-expression.html`. Tant qu’aucune date n’est publiée, son bouton « Découvrir les prochaines dates » ouvre une demande de contact préremplie.

## Publier sur GitHub Pages

1. Poussez ce dossier sur GitHub.
2. Ouvrez les paramètres du dépôt.
3. Allez dans Pages et choisissez la branche principale ainsi que le dossier racine.
