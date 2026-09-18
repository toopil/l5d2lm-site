# Tests de sécurité L5D2LM — à exécuter après connexion Supabase

Ces tests ne doivent pas utiliser Mission Déclic et ne doivent pas modifier ses tables.

## Préparation

Avant de tester :

1. appliquer la migration `202609180001_l5d2lm_foundations.sql` sur un environnement Supabase de test ;
2. créer un utilisateur Auth non-admin ;
3. créer un utilisateur Auth admin L5D2LM ;
4. ajouter uniquement l’UUID de l’admin dans `public.l5d2lm_admins` ;
5. activer MFA/TOTP pour l’admin ;
6. vérifier que la session admin atteint bien `aal2`.

## Scénarios obligatoires

### Visiteur non connecté

- Ne peut pas lire `l5d2lm_admins`.
- Ne peut pas lire les médias brouillons.
- Ne peut pas lire les médias `needs_review`.
- Ne peut pas lire les médias `do_not_publish`.
- Ne peut pas lire les originaux privés.
- Peut lire seulement les sections `published`.
- Peut lire seulement les médias `published`, `ready`, avec droits `authorized` ou `faces_to_blur`, et `public_path`.

### Utilisateur connecté mais non admin L5D2LM

- Ne peut pas administrer L5D2LM.
- Ne peut pas créer de section.
- Ne peut pas importer de média.
- Ne peut pas modifier les droits d’une photo.
- Ne peut pas publier.
- Ne devient pas admin simplement parce qu’il possède un compte Supabase.

### Utilisateur Mission Déclic

- Ne possède aucun droit L5D2LM par défaut.
- Échoue sur les opérations protégées tant que son UUID n’est pas présent et actif dans `l5d2lm_admins`.

### Admin L5D2LM sans AAL2

- Peut être connecté, mais ne doit pas pouvoir faire les actions sensibles.
- Échoue sur création, modification, suppression et publication.
- Ne peut pas gérer les buckets L5D2LM.

### Admin L5D2LM avec AAL2

- Peut créer/modifier/masquer des sections.
- Peut importer des médias dans les buckets L5D2LM.
- Peut créer des relations média ↔ section.
- Peut gérer les cartes postales.
- Peut publier un snapshot.
- Peut lire le journal d’administration.

## Tests métier essentiels

- Une section `hidden` disparaît du rendu public.
- Une photo brouillon est absente du public.
- Une photo `needs_review` est absente du public.
- Une photo `do_not_publish` est absente du public.
- Une photo publiée avec version floutée utilise seulement le fichier public dérivé.
- Un original privé ne sort jamais par URL publique.
- Une photo peut appartenir à trois sections sans duplication de fichier.
- Une annotation override ne remplace l’annotation par défaut que dans le contexte concerné.
- La corbeille conserve l’objet avec `deleted_at` avant suppression définitive.

## À automatiser ensuite

Quand le projet Supabase réel sera disponible, transformer cette checklist en tests SQL automatisés ou en tests d’intégration pilotés par le client Supabase.
