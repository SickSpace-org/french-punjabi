-- French Punjabi — Student progress, lesson Q&A comments, notifications
-- Run after 007_course_content.sql.

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.student_lesson_progress (
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create index if not exists student_lesson_progress_lesson_id_idx on public.student_lesson_progress (lesson_id);

-- One level of nesting only, by design (see enforce_comment_nesting below):
-- a top-level student question (parent_comment_id null), and flat replies
-- (from a student or the admin/teacher) attached to that top-level comment.
create table if not exists public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  admin_id uuid references public.admin_users (id) on delete set null,
  parent_comment_id uuid references public.lesson_comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint lesson_comments_author_check check (num_nonnulls(student_id, admin_id) = 1)
);

create index if not exists lesson_comments_lesson_id_idx on public.lesson_comments (lesson_id);
create index if not exists lesson_comments_parent_id_idx on public.lesson_comments (parent_comment_id);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  comment_id uuid references public.lesson_comments (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists student_notifications_student_id_idx on public.student_notifications (student_id);

-- =========================================================
-- enforce_comment_nesting — CHECK constraints can't reference other rows,
-- so "a reply's parent must itself be top-level" needs a trigger. Also
-- blocks re-parenting after creation (two-level comments never need it,
-- and allowing it later would reopen the same validation problem on every
-- edit).
-- =========================================================

create or replace function public.enforce_comment_nesting()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_grandparent uuid;
begin
  if tg_op = 'UPDATE' and new.parent_comment_id is distinct from old.parent_comment_id then
    raise exception 'parent_comment_id cannot be changed after a comment is created.';
  end if;

  if new.parent_comment_id is not null then
    select parent_comment_id into v_grandparent
    from public.lesson_comments
    where id = new.parent_comment_id;

    if v_grandparent is not null then
      raise exception 'Cannot reply to a reply — comments support only one level of nesting.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_comment_nesting on public.lesson_comments;
create trigger enforce_comment_nesting before insert or update on public.lesson_comments
  for each row execute function public.enforce_comment_nesting();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.student_lesson_progress enable row level security;
alter table public.lesson_comments enable row level security;
alter table public.student_notifications enable row level security;

-- student_lesson_progress
drop policy if exists "progress_admin_write" on public.student_lesson_progress;
create policy "progress_admin_write" on public.student_lesson_progress
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "progress_self_select" on public.student_lesson_progress;
create policy "progress_self_select" on public.student_lesson_progress
  for select using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "progress_self_insert" on public.student_lesson_progress;
create policy "progress_self_insert" on public.student_lesson_progress
  for insert with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
    and exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id and l.status = 'PUBLISHED' and l.is_active and public.has_course_access(l.course_id)
    )
  );

-- lesson_comments — shared per-lesson discussion: any student with active
-- access to the course can see/ask/reply, same as classmates in one room.
drop policy if exists "lesson_comments_admin_write" on public.lesson_comments;
create policy "lesson_comments_admin_write" on public.lesson_comments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lesson_comments_student_select" on public.lesson_comments;
create policy "lesson_comments_student_select" on public.lesson_comments
  for select using (
    exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id and l.status = 'PUBLISHED' and l.is_active and public.has_course_access(l.course_id)
    )
  );

drop policy if exists "lesson_comments_student_insert" on public.lesson_comments;
create policy "lesson_comments_student_insert" on public.lesson_comments
  for insert with check (
    admin_id is null
    and exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
    and exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id and l.status = 'PUBLISHED' and l.is_active and public.has_course_access(l.course_id)
    )
  );

-- student_notifications — only admin ever inserts (from the reply action);
-- a student can read and mark-read only their own.
drop policy if exists "notifications_admin_write" on public.student_notifications;
create policy "notifications_admin_write" on public.student_notifications
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_self_select" on public.student_notifications;
create policy "notifications_self_select" on public.student_notifications
  for select using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "notifications_self_update" on public.student_notifications;
create policy "notifications_self_update" on public.student_notifications
  for update using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

-- =========================================================
-- Grants
-- =========================================================

grant select, insert, update, delete on
  public.student_lesson_progress, public.lesson_comments, public.student_notifications
  to authenticated;
