-- Fondations L5D2LM pour Supabase.
-- Cette migration ne touche pas Mission Declic.
-- Tous les objets metier crees ici sont prefixes l5d2lm_.

create extension if not exists pgcrypto;

create table if not exists public.l5d2lm_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint l5d2lm_admins_active_deactivated_check
    check ((active = true and deactivated_at is null) or (active = false))
);

create or replace function public.l5d2lm_has_aal2()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create or replace function public.l5d2lm_is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.l5d2lm_admins admin
    where admin.user_id = auth.uid()
      and admin.active = true
      and admin.deactivated_at is null
  );
$$;

create or replace function public.l5d2lm_can_admin()
returns boolean
language sql
stable
as $$
  select public.l5d2lm_is_active_admin() and public.l5d2lm_has_aal2();
$$;

create table if not exists public.l5d2lm_sections (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.l5d2lm_sections(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text,
  kind text not null default 'section',
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint l5d2lm_sections_status_check
    check (status in ('draft', 'published', 'hidden')),
  constraint l5d2lm_sections_kind_check
    check (kind in ('section', 'proposal', 'event', 'collection_view'))
);

create table if not exists public.l5d2lm_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  event_date date,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint l5d2lm_collections_visibility_check
    check (visibility in ('private', 'published'))
);

create table if not exists public.l5d2lm_upload_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  imported_by uuid references auth.users(id) on delete set null,
  media_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.l5d2lm_media (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  original_mime_type text,
  original_byte_size bigint,
  original_sha256 text,
  original_private_path text not null,
  public_path text,
  admin_thumbnail_path text,
  collection_id uuid references public.l5d2lm_collections(id) on delete set null,
  upload_batch_id uuid references public.l5d2lm_upload_batches(id) on delete set null,
  default_annotation text,
  alt_text text,
  rights_status text not null default 'needs_review',
  publish_status text not null default 'draft',
  processing_status text not null default 'pending',
  favorite boolean not null default false,
  focal_x numeric(4,3) not null default 0.5,
  focal_y numeric(4,3) not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint l5d2lm_media_rights_status_check
    check (rights_status in ('authorized', 'faces_to_blur', 'needs_review', 'do_not_publish')),
  constraint l5d2lm_media_publish_status_check
    check (publish_status in ('draft', 'published', 'archived')),
  constraint l5d2lm_media_processing_status_check
    check (processing_status in ('pending', 'processing', 'ready', 'error')),
  constraint l5d2lm_media_focal_x_check check (focal_x >= 0 and focal_x <= 1),
  constraint l5d2lm_media_focal_y_check check (focal_y >= 0 and focal_y <= 1)
);

create unique index if not exists l5d2lm_media_original_sha256_idx
  on public.l5d2lm_media(original_sha256)
  where original_sha256 is not null and deleted_at is null;

create table if not exists public.l5d2lm_media_sections (
  media_id uuid not null references public.l5d2lm_media(id) on delete cascade,
  section_id uuid not null references public.l5d2lm_sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, section_id)
);

create table if not exists public.l5d2lm_media_usages (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.l5d2lm_media(id) on delete cascade,
  section_id uuid references public.l5d2lm_sections(id) on delete cascade,
  role text not null default 'postcard',
  annotation_override text,
  alt_override text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint l5d2lm_media_usages_role_check
    check (role in ('cover', 'fixed', 'postcard', 'rotation', 'inline'))
);

create table if not exists public.l5d2lm_postcard_configs (
  section_id uuid primary key references public.l5d2lm_sections(id) on delete cascade,
  enabled boolean not null default false,
  visible_count integer not null default 3,
  rotation_mode text not null default 'random',
  preload_count integer not null default 3,
  updated_at timestamptz not null default now(),
  constraint l5d2lm_postcard_visible_count_check check (visible_count >= 1 and visible_count <= 12),
  constraint l5d2lm_postcard_preload_count_check check (preload_count >= 0 and preload_count <= 24),
  constraint l5d2lm_postcard_rotation_mode_check check (rotation_mode in ('fixed', 'random', 'semi_random'))
);

create table if not exists public.l5d2lm_text_blocks (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null,
  block_key text not null,
  title text,
  eyebrow text,
  lead text,
  body text,
  button_label text,
  button_url text,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint l5d2lm_text_blocks_status_check
    check (status in ('draft', 'published', 'hidden')),
  unique (page_slug, block_key, status)
);

create table if not exists public.l5d2lm_publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_type text not null,
  payload jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  constraint l5d2lm_publication_snapshots_type_check
    check (snapshot_type in ('site', 'sections', 'media', 'texts', 'postcards'))
);

create table if not exists public.l5d2lm_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  object_type text not null,
  object_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists l5d2lm_sections_parent_sort_idx
  on public.l5d2lm_sections(parent_id, sort_order);

create index if not exists l5d2lm_media_collection_idx
  on public.l5d2lm_media(collection_id);

create index if not exists l5d2lm_media_upload_batch_idx
  on public.l5d2lm_media(upload_batch_id);

create index if not exists l5d2lm_media_status_rights_idx
  on public.l5d2lm_media(publish_status, rights_status, processing_status);

create index if not exists l5d2lm_media_usages_section_idx
  on public.l5d2lm_media_usages(section_id, active, sort_order);

alter table public.l5d2lm_admins enable row level security;
alter table public.l5d2lm_sections enable row level security;
alter table public.l5d2lm_collections enable row level security;
alter table public.l5d2lm_upload_batches enable row level security;
alter table public.l5d2lm_media enable row level security;
alter table public.l5d2lm_media_sections enable row level security;
alter table public.l5d2lm_media_usages enable row level security;
alter table public.l5d2lm_postcard_configs enable row level security;
alter table public.l5d2lm_text_blocks enable row level security;
alter table public.l5d2lm_publication_snapshots enable row level security;
alter table public.l5d2lm_admin_events enable row level security;

-- L'amorcage du premier administrateur doit etre fait par un compte service
-- ou dans l'interface SQL Supabase. Le frontend ne doit jamais pouvoir creer
-- son propre administrateur.

drop policy if exists "l5d2lm admins can read admins" on public.l5d2lm_admins;
create policy "l5d2lm admins can read admins"
on public.l5d2lm_admins
for select
using (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm admins can manage admins" on public.l5d2lm_admins;
create policy "l5d2lm admins can manage admins"
on public.l5d2lm_admins
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read published sections" on public.l5d2lm_sections;
create policy "l5d2lm public can read published sections"
on public.l5d2lm_sections
for select
using (status = 'published' and deleted_at is null);

drop policy if exists "l5d2lm admins can manage sections" on public.l5d2lm_sections;
create policy "l5d2lm admins can manage sections"
on public.l5d2lm_sections
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read published collections" on public.l5d2lm_collections;
create policy "l5d2lm public can read published collections"
on public.l5d2lm_collections
for select
using (visibility = 'published' and deleted_at is null);

drop policy if exists "l5d2lm admins can manage collections" on public.l5d2lm_collections;
create policy "l5d2lm admins can manage collections"
on public.l5d2lm_collections
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm admins can manage upload batches" on public.l5d2lm_upload_batches;
create policy "l5d2lm admins can manage upload batches"
on public.l5d2lm_upload_batches
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read published media" on public.l5d2lm_media;
create policy "l5d2lm public can read published media"
on public.l5d2lm_media
for select
using (
  publish_status = 'published'
  and processing_status = 'ready'
  and rights_status in ('authorized', 'faces_to_blur')
  and public_path is not null
  and deleted_at is null
);

drop policy if exists "l5d2lm admins can manage media" on public.l5d2lm_media;
create policy "l5d2lm admins can manage media"
on public.l5d2lm_media
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read published media sections" on public.l5d2lm_media_sections;
create policy "l5d2lm public can read published media sections"
on public.l5d2lm_media_sections
for select
using (
  exists (
    select 1 from public.l5d2lm_media media
    where media.id = media_id
      and media.publish_status = 'published'
      and media.processing_status = 'ready'
      and media.rights_status in ('authorized', 'faces_to_blur')
      and media.public_path is not null
      and media.deleted_at is null
  )
  and exists (
    select 1 from public.l5d2lm_sections section
    where section.id = section_id
      and section.status = 'published'
      and section.deleted_at is null
  )
);

drop policy if exists "l5d2lm admins can manage media sections" on public.l5d2lm_media_sections;
create policy "l5d2lm admins can manage media sections"
on public.l5d2lm_media_sections
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read active published usages" on public.l5d2lm_media_usages;
create policy "l5d2lm public can read active published usages"
on public.l5d2lm_media_usages
for select
using (
  active = true
  and deleted_at is null
  and exists (
    select 1 from public.l5d2lm_media media
    where media.id = media_id
      and media.publish_status = 'published'
      and media.processing_status = 'ready'
      and media.rights_status in ('authorized', 'faces_to_blur')
      and media.public_path is not null
      and media.deleted_at is null
  )
  and (
    section_id is null
    or exists (
      select 1 from public.l5d2lm_sections section
      where section.id = section_id
        and section.status = 'published'
        and section.deleted_at is null
    )
  )
);

drop policy if exists "l5d2lm admins can manage media usages" on public.l5d2lm_media_usages;
create policy "l5d2lm admins can manage media usages"
on public.l5d2lm_media_usages
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read postcard configs" on public.l5d2lm_postcard_configs;
create policy "l5d2lm public can read postcard configs"
on public.l5d2lm_postcard_configs
for select
using (
  enabled = true
  and exists (
    select 1 from public.l5d2lm_sections section
    where section.id = section_id
      and section.status = 'published'
      and section.deleted_at is null
  )
);

drop policy if exists "l5d2lm admins can manage postcard configs" on public.l5d2lm_postcard_configs;
create policy "l5d2lm admins can manage postcard configs"
on public.l5d2lm_postcard_configs
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read published text blocks" on public.l5d2lm_text_blocks;
create policy "l5d2lm public can read published text blocks"
on public.l5d2lm_text_blocks
for select
using (status = 'published' and deleted_at is null);

drop policy if exists "l5d2lm admins can manage text blocks" on public.l5d2lm_text_blocks;
create policy "l5d2lm admins can manage text blocks"
on public.l5d2lm_text_blocks
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm public can read publication snapshots" on public.l5d2lm_publication_snapshots;
create policy "l5d2lm public can read publication snapshots"
on public.l5d2lm_publication_snapshots
for select
using (true);

drop policy if exists "l5d2lm admins can manage publication snapshots" on public.l5d2lm_publication_snapshots;
create policy "l5d2lm admins can manage publication snapshots"
on public.l5d2lm_publication_snapshots
for all
using (public.l5d2lm_can_admin())
with check (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm admins can read admin events" on public.l5d2lm_admin_events;
create policy "l5d2lm admins can read admin events"
on public.l5d2lm_admin_events
for select
using (public.l5d2lm_can_admin());

drop policy if exists "l5d2lm admins can create admin events" on public.l5d2lm_admin_events;
create policy "l5d2lm admins can create admin events"
on public.l5d2lm_admin_events
for insert
with check (public.l5d2lm_can_admin());

insert into storage.buckets (id, name, public)
values
  ('l5d2lm-private-originals', 'l5d2lm-private-originals', false),
  ('l5d2lm-public-media', 'l5d2lm-public-media', true),
  ('l5d2lm-admin-thumbnails', 'l5d2lm-admin-thumbnails', false)
on conflict (id) do nothing;

drop policy if exists "l5d2lm public can read public media objects" on storage.objects;
create policy "l5d2lm public can read public media objects"
on storage.objects
for select
using (bucket_id = 'l5d2lm-public-media');

drop policy if exists "l5d2lm admins can manage l5d2lm storage objects" on storage.objects;
create policy "l5d2lm admins can manage l5d2lm storage objects"
on storage.objects
for all
using (
  bucket_id in ('l5d2lm-private-originals', 'l5d2lm-public-media', 'l5d2lm-admin-thumbnails')
  and public.l5d2lm_can_admin()
)
with check (
  bucket_id in ('l5d2lm-private-originals', 'l5d2lm-public-media', 'l5d2lm-admin-thumbnails')
  and public.l5d2lm_can_admin()
);
