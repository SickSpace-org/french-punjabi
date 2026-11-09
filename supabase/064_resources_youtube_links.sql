-- French Punjabi — 064: YouTube-link resources, so /resources can list videos (link only; visitors are sent to YouTube).
--
-- PLAIN LANGUAGE: two new columns on public.resources and a handful of CHECK constraints. Nothing is removed from the table, no row
-- is rewritten, and every existing row becomes a "pdf" resource automatically (the new column defaults to 'pdf'). The only existing
-- rule that changes is the "published only when ready" constraint: it used to say "needs object_key", and now says "a PDF needs its
-- file (object_key), a YouTube resource needs a valid video ID". Nothing in the storage schema is touched.
--
--   resource_type     'pdf' (default) or 'youtube'. Chosen when the resource is created and never changed afterwards by the app.
--   youtube_video_id  the 11-character YouTube video ID ONLY — never the pasted URL. The app builds the watch link and the thumbnail
--                     address from it. NULL for PDFs.
--
-- Rules enforced by the database:
--   * resource_type is 'pdf' or 'youtube'.
--   * youtube_video_id, when present, is exactly 11 characters from [A-Za-z0-9_-].
--   * A PDF has no video ID; a YouTube resource has no file keys (object_key / pending_object_key).
--   * Published only when ready: a PDF needs object_key, a YouTube resource needs a (format-checked) youtube_video_id.
--
-- Access is unchanged: row-level security stays ON with NO policies, and the explicit revokes from public / anon / authenticated
-- are restated below (harmless if already in place). Only service_role can use the table.
--
-- Safe to re-run: columns use "if not exists"; each constraint is dropped "if exists" and re-added; the grants are idempotent.
-- Existing rows already satisfy every new constraint (type 'pdf', no video ID, published rows have object_key), so adding them
-- cannot fail on current data. The table is small, so the brief lock for adding constraints is not a concern.

do $guard$
begin
  if to_regclass('public.resources') is null then
    raise exception '064 needs public.resources: apply 063_public_resources.sql first';
  end if;
end
$guard$;

alter table public.resources
  add column if not exists resource_type    text not null default 'pdf',
  add column if not exists youtube_video_id text;

alter table public.resources drop constraint if exists resources_resource_type_valid;
alter table public.resources add constraint resources_resource_type_valid
  check (resource_type in ('pdf', 'youtube'));

alter table public.resources drop constraint if exists resources_youtube_video_id_format;
alter table public.resources add constraint resources_youtube_video_id_format
  check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');

alter table public.resources drop constraint if exists resources_type_consistent;
alter table public.resources add constraint resources_type_consistent
  check (
    (resource_type = 'pdf' and youtube_video_id is null)
    or (resource_type = 'youtube' and object_key is null and pending_object_key is null)
  );

-- Replaces 063's "resources_published_needs_file".
alter table public.resources drop constraint if exists resources_published_needs_file;
alter table public.resources drop constraint if exists resources_published_needs_content;
alter table public.resources add constraint resources_published_needs_content
  check (
    not is_published
    or (resource_type = 'pdf' and object_key is not null)
    or (resource_type = 'youtube' and youtube_video_id is not null)
  );

-- Access: unchanged, restated. RLS on, no policies, nothing for public / anon / authenticated.
alter table public.resources enable row level security;
revoke all on table public.resources from public, anon, authenticated;
grant all on table public.resources to service_role;

-- ROLLBACK (only while you are happy to lose the video resources — delete them first):
--   delete from public.resources where resource_type = 'youtube';
--   alter table public.resources
--     drop constraint resources_published_needs_content,
--     drop constraint resources_type_consistent,
--     drop constraint resources_youtube_video_id_format,
--     drop constraint resources_resource_type_valid;
--   alter table public.resources add constraint resources_published_needs_file
--     check (not is_published or object_key is not null);
--   alter table public.resources drop column youtube_video_id, drop column resource_type;
