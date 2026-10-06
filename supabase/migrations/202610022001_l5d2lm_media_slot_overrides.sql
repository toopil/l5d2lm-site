-- Permet de retirer la photo d'un emplacement même quand elle n'a
-- jamais été "gérée" depuis Gestion — c'est-à-dire une photo déjà
-- présente sur le site avant ce mécanisme (voir build/slots.py,
-- `fallback`) et jamais remplacée depuis. Jusqu'ici, de tels
-- emplacements ("Photo déjà en ligne, pas encore gérée ici") n'avaient
-- aucun bouton "Retirer" : il n'existe aucune ligne l5d2lm_media_usages
-- à supprimer pour eux, donc rien à "retirer" côté base — d'où ce
-- mécanisme séparé, minimal, qui ne touche pas au schéma existant.
--
-- hidden=true = forcer cet emplacement vide, en ignorant à la fois une
-- éventuelle photo gérée ET le fallback (voir build/build.py,
-- render_slot). Absence de ligne = comportement normal, inchangé.
create table if not exists public.l5d2lm_media_slot_overrides (
  slot_key text primary key,
  hidden boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.l5d2lm_media_slot_overrides enable row level security;

drop policy if exists "l5d2lm public can read slot overrides" on public.l5d2lm_media_slot_overrides;
create policy "l5d2lm public can read slot overrides"
on public.l5d2lm_media_slot_overrides
for select
using (true);

drop policy if exists "l5d2lm admins can manage slot overrides" on public.l5d2lm_media_slot_overrides;
create policy "l5d2lm admins can manage slot overrides"
on public.l5d2lm_media_slot_overrides
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());
