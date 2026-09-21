-- Emplacements photo fixes du site public (ex. les 5 "propositions" de
-- Corps & expression) : un identifiant stable par emplacement, choisi et
-- publié depuis l'admin, lu par build/build.py à la génération des pages.
-- Additif uniquement : ne touche a aucune donnee existante, ne modifie
-- aucune table Mission Declic. Le bucket Storage public (l5d2lm-public-media)
-- et ses politiques RLS existent deja depuis 202609180001.

alter table public.l5d2lm_media_usages
  add column if not exists slot_key text;

-- Au plus une association active par emplacement : choisir une nouvelle
-- photo pour un emplacement doit remplacer l'ancienne, jamais s'y ajouter.
create unique index if not exists l5d2lm_media_usages_slot_key_idx
  on public.l5d2lm_media_usages(slot_key)
  where slot_key is not null and active = true and deleted_at is null;
