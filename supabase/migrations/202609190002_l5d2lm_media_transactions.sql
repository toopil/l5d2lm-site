-- Operations transactionnelles pour la vue "par page" de l'admin L5D2LM.
-- Additif uniquement : ne touche a aucune donnee existante, ne modifie
-- aucune table Mission Declic.
--
-- language plpgsql (pas security definer) : les instructions DML a
-- l'interieur de ces fonctions s'executent avec le role de l'appelant,
-- donc les politiques RLS existantes ("l5d2lm admins can manage media
-- sections" / "... media usages", basees sur l5d2lm_can_admin()) s'appliquent
-- normalement. La verification explicite ci-dessous sert seulement a
-- renvoyer un message clair plus tot, pas a se substituer a la RLS.

create or replace function public.l5d2lm_replace_section_media(
  p_section_id uuid,
  p_old_media_id uuid,
  p_new_media_id uuid
)
returns void
language plpgsql
as $$
declare
  v_sort_order integer;
begin
  if not public.l5d2lm_can_admin() then
    raise exception 'Acces refuse : administrateur L5D2LM avec MFA valide requis.';
  end if;

  select sort_order into v_sort_order
  from public.l5d2lm_media_sections
  where media_id = p_old_media_id and section_id = p_section_id;

  if v_sort_order is null then
    raise exception 'Cette photo n''est plus associee a cette page.';
  end if;

  if not exists (
    select 1 from public.l5d2lm_media
    where id = p_new_media_id and deleted_at is null
  ) then
    raise exception 'La photo de remplacement est introuvable ou a ete supprimee.';
  end if;

  if exists (
    select 1 from public.l5d2lm_media_sections
    where media_id = p_new_media_id and section_id = p_section_id
  ) then
    raise exception 'Cette photo est deja presente sur cette page.';
  end if;

  delete from public.l5d2lm_media_sections
  where media_id = p_old_media_id and section_id = p_section_id;

  insert into public.l5d2lm_media_sections (media_id, section_id, sort_order)
  values (p_new_media_id, p_section_id, v_sort_order);

  -- Les usages contextuels (annotation_override, role...) propres a CETTE
  -- page suivent la position, pas l'ancienne photo.
  update public.l5d2lm_media_usages
  set media_id = p_new_media_id
  where media_id = p_old_media_id and section_id = p_section_id;
end;
$$;

create or replace function public.l5d2lm_reorder_section_media(
  p_section_id uuid,
  p_media_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  v_media_id uuid;
  v_idx integer := 0;
begin
  if not public.l5d2lm_can_admin() then
    raise exception 'Acces refuse : administrateur L5D2LM avec MFA valide requis.';
  end if;

  foreach v_media_id in array p_media_ids loop
    update public.l5d2lm_media_sections
    set sort_order = v_idx * 10
    where media_id = v_media_id and section_id = p_section_id;

    if not found then
      raise exception 'Photo % introuvable sur cette page : ordre non enregistre.', v_media_id;
    end if;

    v_idx := v_idx + 1;
  end loop;
end;
$$;
