-- Ajoute un ordre d'affichage par photo au sein d'une categorie.
-- Additif uniquement : ne touche a aucune donnee existante, ne modifie
-- aucune table Mission Declic.

alter table public.l5d2lm_media_sections
  add column if not exists sort_order integer not null default 0;

create index if not exists l5d2lm_media_sections_order_idx
  on public.l5d2lm_media_sections(section_id, sort_order);
