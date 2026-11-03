-- French Punjabi — 063: public_resources, the table behind the public /resources pages (free PDF assignments).
--
-- PLAIN LANGUAGE: one new table (public.resources) and one small trigger function. No existing table, column, policy or function is
-- changed, and NOTHING in the storage schema is touched: the PDF files live in a new private Cloudflare R2 bucket, not in Supabase
-- Storage (see D:\SickSpace\ship-files\RESOURCES-CLOUDFLARE-CHECKLIST.md), so there is no bucket insert here.
--
-- One row = one resource: title, description (shown as real text on the public page), a free-text category, an order, a published
-- flag, and ONE file. object_key is the R2 object name of the ready file; pending_object_key is a file that was uploaded (or is being
-- uploaded) but not yet verified. Both are random UUID names ("<uuid>.pdf") and the format is enforced by CHECK constraints.
-- "Published only when ready" is a CHECK constraint: a row cannot be published unless object_key is set.
--
-- Access: row-level security is ON and there are NO policies, and all privileges are revoked EXPLICITLY from public, anon and
-- authenticated (Supabase's default privileges would otherwise grant them). Only service_role can use the table. The public pages
-- and the admin pages both read and write through the server (service-role key), and every admin action first re-checks that the
-- caller is an admin. The trigger function below also has execute revoked from public, anon and authenticated.
--
-- Safe to re-run: every statement is "if not exists", "create or replace" or "drop ... if exists".

create table if not exists public.resources (
  id                 uuid        primary key default gen_random_uuid(),
  slug               text        not null,
  title              text        not null,
  description        text        not null default '',
  category           text        not null default '',                -- free text; the admin form suggests existing categories
  display_order      integer     not null default 0,
  is_published       boolean     not null default false,
  object_key         text,                                           -- R2 object name of the ready file, e.g. 3f0c...-....pdf
  pending_object_key text,                                           -- uploaded but not yet verified (finalize step)
  original_name      text,                                           -- the file name the admin picked, for display only
  size_bytes         bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint resources_slug_key unique (slug),
  constraint resources_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint resources_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint resources_description_length check (char_length(description) <= 5000),
  constraint resources_category_length check (char_length(category) <= 60),
  constraint resources_object_key_format check (
    object_key is null or object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  ),
  constraint resources_pending_object_key_format check (
    pending_object_key is null or pending_object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  ),
  constraint resources_size_positive check (size_bytes is null or size_bytes > 0),
  constraint resources_published_needs_file check (not is_published or object_key is not null)
);

create index if not exists resources_published_order_idx
  on public.resources (is_published, display_order, created_at);

alter table public.resources enable row level security;

revoke all on table public.resources from public, anon, authenticated;
grant all on table public.resources to service_role;

-- No policy exists for anyone: with RLS on, the browser (anon or signed in) can never read or write this table.

create or replace function public.resources_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.resources_touch_updated_at() from public, anon, authenticated;
grant execute on function public.resources_touch_updated_at() to service_role;

drop trigger if exists resources_touch_updated_at on public.resources;
create trigger resources_touch_updated_at
  before update on public.resources
  for each row execute function public.resources_touch_updated_at();

-- ROLLBACK (only before real use, because the table holds the resources):
--   drop table public.resources;                                   -- also drops the trigger
--   drop function public.resources_touch_updated_at();
