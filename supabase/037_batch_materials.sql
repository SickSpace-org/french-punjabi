-- French Punjabi — Teacher Portal, Phase 4b: teacher-uploaded batch
-- materials (PDFs/notes/modules) via a private Supabase Storage bucket,
-- reusing everything from Phase 4a rather than duplicating it. Run after
-- 036_teacher_recordings.sql.
--
-- Reuse, confirmed before writing this (not assumed):
--  - batch_owned_by_current_teacher(uuid) / student_owns_current_batch(uuid)
--    (033/034) are used AS-IS in the storage.objects policies below —
--    same single-uuid-arg, security-definer, boolean-returning shape
--    already proven safe in storage.objects policies by has_course_access()
--    (009_lesson_resources_storage.sql / 012_lesson_videos_storage.sql).
--    No wrapper needed. Both are already `language plpgsql` (not sql),
--    which is the more conservative choice anyway (see
--    033_fix_teacher_rls_recursion.sql for why that matters when a
--    security-definer function is used inside another table's RLS).
--  - teacher_content_audit (034) needs NO schema change — content_type,
--    storage_path, and title already exist there specifically for this.
--  - Bucket config mirrors lesson-resources (009) exactly: no
--    file_size_limit/allowed_mime_types (only the video bucket, 012, sets
--    those) — private, path convention {batch_id}/{filename}.
--
-- Enforcement split, spelled out:
--  - The actual FILE BYTES go through Supabase Storage's own API directly
--    (there is no RPC-mediated upload path for object bytes) — but that
--    API is fully governed by the storage.objects RLS policies below,
--    using the same ownership functions as everything else, so this is
--    real database-level enforcement, not just a UI restriction — same
--    pattern lesson-resources already uses for admin uploads.
--  - The METADATA (batch_materials row + the audit log) goes through
--    SECURITY DEFINER RPCs (teacher_add_material / teacher_update_material /
--    teacher_delete_material), mirroring the recordings RPCs (034)
--    exactly — teachers get zero direct grant on batch_materials beyond a
--    read policy, and none at all on teacher_content_audit.

-- =========================================================
-- Table
-- =========================================================

create table public.batch_materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batch_materials_batch_id_idx on public.batch_materials (batch_id);

drop trigger if exists set_updated_at on public.batch_materials;
create trigger set_updated_at before update on public.batch_materials
  for each row execute function public.set_updated_at();

-- =========================================================
-- Row Level Security — same shape as class_recordings (034): teachers and
-- students may READ their own batch's rows directly; there is no matching
-- insert/update/delete policy for either role, so all writes go through
-- the RPCs below.
-- =========================================================

alter table public.batch_materials enable row level security;

drop policy if exists "batch_materials_admin_write" on public.batch_materials;
create policy "batch_materials_admin_write" on public.batch_materials
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "batch_materials_teacher_select" on public.batch_materials;
create policy "batch_materials_teacher_select" on public.batch_materials
  for select using (public.batch_owned_by_current_teacher(batch_id));

drop policy if exists "batch_materials_student_select" on public.batch_materials;
create policy "batch_materials_student_select" on public.batch_materials
  for select using (public.student_owns_current_batch(batch_id));

grant select, insert, update, delete on public.batch_materials to authenticated;

-- =========================================================
-- Storage bucket + policies — mirrors 009_lesson_resources_storage.sql's
-- structure exactly, just scoped by teacher/student ownership functions
-- instead of has_course_access(). Objects are uploaded under
-- {batch_id}/{filename}, so storage.foldername(name)[1] is the batch_id.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('batch-materials', 'batch-materials', false)
on conflict (id) do nothing;

drop policy if exists "batch_materials_storage_admin_all" on storage.objects;
create policy "batch_materials_storage_admin_all" on storage.objects
  for all using (bucket_id = 'batch-materials' and public.is_admin())
  with check (bucket_id = 'batch-materials' and public.is_admin());

-- Teacher: full access (upload + read + delete the raw object), but only
-- within their own batch's folder. This is genuinely how the file itself
-- gets uploaded/removed — there's no RPC equivalent for object bytes.
drop policy if exists "batch_materials_storage_teacher_all" on storage.objects;
create policy "batch_materials_storage_teacher_all" on storage.objects
  for all using (
    bucket_id = 'batch-materials'
    and public.batch_owned_by_current_teacher(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'batch-materials'
    and public.batch_owned_by_current_teacher(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "batch_materials_storage_student_select" on storage.objects;
create policy "batch_materials_storage_student_select" on storage.objects
  for select using (
    bucket_id = 'batch-materials'
    and public.student_owns_current_batch(((storage.foldername(name))[1])::uuid)
  );

-- =========================================================
-- teacher_add_material() / teacher_update_material() / teacher_delete_material()
-- — mirror teacher_add_recording()/teacher_update_recording()/
-- teacher_delete_recording() (034) exactly: each performs the metadata
-- mutation and the teacher_content_audit row in the same function call,
-- with the audit insert wrapped in its own non-fatal exception handler
-- (same best-effort tradeoff as batch_change_history, confirmed with the
-- user for 4a and carried over here unchanged).
--
-- teacher_add_material() does NOT touch storage — the file itself is
-- already uploaded (via the storage.objects policy above) by the time
-- this is called; this only records the metadata row + audit entry. It
-- does independently check that p_storage_path actually starts with
-- p_batch_id, so the metadata can never claim a path outside the
-- teacher's own folder even though the file bytes themselves stay
-- separately gated regardless.
-- =========================================================

create or replace function public.teacher_add_material(
  p_batch_id uuid, p_storage_path text, p_title text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_id uuid;
begin
  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(p_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_storage_path is null or p_storage_path !~ ('^' || p_batch_id::text || '/') then
    raise exception 'storage_path must belong to this batch';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  v_id := gen_random_uuid();

  insert into public.batch_materials (id, batch_id, teacher_id, teacher_name_snapshot, title, storage_path)
  values (v_id, p_batch_id, v_teacher_id, v_teacher_name, trim(p_title), p_storage_path);

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, storage_path)
    values
      ('material', v_id, p_batch_id, v_teacher_id, v_teacher_name, 'created', trim(p_title), p_storage_path);
  exception when others then
    raise warning 'teacher_content_audit insert failed (create, material %): %', v_id, sqlerrm;
  end;

  return v_id;
end;
$$;

grant execute on function public.teacher_add_material(uuid, text, text) to authenticated;

-- Rename-only "edit" for this pass — replacing the underlying file is a
-- delete + re-add, not modeled as an in-place update.
create or replace function public.teacher_update_material(p_material_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
  v_storage_path text;
begin
  select batch_id, storage_path into v_batch_id, v_storage_path
  from public.batch_materials where id = p_material_id;
  if v_batch_id is null then
    raise exception 'material not found';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;

  update public.batch_materials set title = trim(p_title) where id = p_material_id;

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, storage_path)
    values
      ('material', p_material_id, v_batch_id, v_teacher_id, v_teacher_name, 'updated', trim(p_title), v_storage_path);
  exception when others then
    raise warning 'teacher_content_audit insert failed (update, material %): %', p_material_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_update_material(uuid, text) to authenticated;

-- Removes the metadata row only — the caller deletes the underlying
-- storage object itself via the storage.objects policy above (a separate
-- Storage API call), same "file bytes have no RPC path" reasoning as
-- teacher_add_material().
create or replace function public.teacher_delete_material(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
  v_title text;
  v_storage_path text;
begin
  select batch_id, title, storage_path into v_batch_id, v_title, v_storage_path
  from public.batch_materials where id = p_material_id;
  if v_batch_id is null then
    raise exception 'material not found';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;

  delete from public.batch_materials where id = p_material_id;

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, storage_path)
    values
      ('material', p_material_id, v_batch_id, v_teacher_id, v_teacher_name, 'deleted', v_title, v_storage_path);
  exception when others then
    raise warning 'teacher_content_audit insert failed (delete, material %): %', p_material_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_delete_material(uuid) to authenticated;
