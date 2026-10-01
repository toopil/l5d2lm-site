-- Corrige l5d2lm_text_blocks pour permettre un vrai historique des
-- versions publiées (Site > Textes).
--
-- La contrainte d'origine (migration de fondation) est :
--   unique (page_slug, block_key, status)
-- Une contrainte unique classique ne tient PAS compte de deleted_at : elle
-- interdirait d'archiver une ancienne version "published" (en la gardant,
-- deleted_at renseigné) dès qu'on publie une deuxième modification du même
-- bloc, puisque la nouvelle ligne "published" entrerait en conflit avec
-- l'ancienne malgré son archivage. Remplacée par un index unique PARTIEL,
-- qui ne porte que sur les lignes actives (deleted_at is null) :
-- plusieurs versions archivées peuvent désormais coexister pour un même
-- bloc, et l'admin peut consulter/restaurer une version précédente.
--
-- Additif et purement permissif : relâche une contrainte existante, n'en
-- ajoute aucune nouvelle. Aucune donnée n'est modifiée (table vide à ce
-- jour). Le nom de la contrainte d'origine est retrouvé dynamiquement
-- plutôt que supposé, pour rester sûr même s'il diffère du nom généré par
-- défaut.

do $$
declare
  found_constraint text;
begin
  select tc.constraint_name into found_constraint
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'l5d2lm_text_blocks'
    and tc.constraint_type = 'UNIQUE';
  if found_constraint is not null then
    execute format('alter table public.l5d2lm_text_blocks drop constraint %I', found_constraint);
  end if;
end $$;

create unique index if not exists l5d2lm_text_blocks_active_unique
  on public.l5d2lm_text_blocks (page_slug, block_key, status)
  where deleted_at is null;
