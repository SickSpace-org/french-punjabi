-- French Punjabi — Course Content (learning courses/weeks/lessons/resources)
-- + student_course_access. Run after 006_student_accounts.sql.
--
-- This is a DIFFERENT concept from public.phases/levels/batches (the
-- pricing/timing marketing data managed at /admin/courses) — course_content
-- is the private learning material managed at /admin/content, gated behind
-- authenticated student access, never publicly readable.

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.course_content (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  level_id uuid references public.levels (id) on delete cascade,
  title text not null,
  description text,
  thumbnail_url text,
  status text not null default 'DRAFT',
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_content_status_check check (status in ('DRAFT', 'PUBLISHED'))
);

alter table public.course_content add column if not exists is_active boolean not null default true;

create table if not exists public.course_weeks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course_content (id) on delete cascade,
  week_number int not null,
  title text not null,
  description text,
  display_order int not null default 0,
  status text not null default 'DRAFT',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_weeks_status_check check (status in ('DRAFT', 'PUBLISHED'))
);

alter table public.course_weeks add column if not exists is_active boolean not null default true;

-- course_id is denormalized (also derivable via week_id -> course_weeks.course_id)
-- so every RLS policy below is a single-column check instead of a two-hop
-- join, and so "is the whole chain published" is a cheap AND instead of a
-- multi-table walk. A trigger keeps it structurally impossible to drift.
create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.course_weeks (id) on delete cascade,
  course_id uuid not null references public.course_content (id) on delete cascade,
  title text not null,
  description text,
  notes text,
  video_url text,
  video_provider text,
  display_order int not null default 0,
  status text not null default 'DRAFT',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_lessons_status_check check (status in ('DRAFT', 'PUBLISHED'))
);

alter table public.course_lessons add column if not exists is_active boolean not null default true;

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  title text not null,
  storage_path text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_course_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.course_content (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  status text not null default 'ACTIVE',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_course_access_status_check check (status in ('ACTIVE', 'REVOKED')),
  constraint student_course_access_unique unique (student_id, course_id)
);

create index if not exists course_weeks_course_id_idx on public.course_weeks (course_id);
create index if not exists course_lessons_course_id_idx on public.course_lessons (course_id);
create index if not exists course_lessons_week_id_idx on public.course_lessons (week_id);
create index if not exists lesson_resources_lesson_id_idx on public.lesson_resources (lesson_id);
create index if not exists student_course_access_student_id_idx on public.student_course_access (student_id);
create index if not exists student_course_access_course_id_idx on public.student_course_access (course_id);

do $$
declare
  t text;
begin
  foreach t in array array['course_content', 'course_weeks', 'course_lessons', 'lesson_resources', 'student_course_access'] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- =========================================================
-- course_id auto-derivation trigger — makes the denormalized column on
-- course_lessons structurally impossible to drift from its real parent,
-- even via a manual SQL edit.
-- =========================================================

create or replace function public.set_lesson_course_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  select course_id into v_course_id from public.course_weeks where id = new.week_id;
  if v_course_id is null then
    raise exception 'course_weeks % not found', new.week_id;
  end if;
  new.course_id := v_course_id;
  return new;
end;
$$;

drop trigger if exists set_lesson_course_id on public.course_lessons;
create trigger set_lesson_course_id before insert or update of week_id on public.course_lessons
  for each row execute function public.set_lesson_course_id();

-- =========================================================
-- has_course_access() — mirrors is_admin()/is_active_student()'s shape.
-- Security definer so it can read student_course_access regardless of the
-- caller's own row-level access, exactly like is_admin() reads admin_users.
-- =========================================================

create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.student_course_access sca
    join public.students s on s.id = sca.student_id
    where s.auth_user_id = auth.uid()
      and s.status = 'ACTIVE'
      and sca.course_id = p_course_id
      and sca.status = 'ACTIVE'
  );
$$;

grant execute on function public.has_course_access(uuid) to authenticated;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.course_content enable row level security;
alter table public.course_weeks enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.student_course_access enable row level security;

-- course_content
drop policy if exists "course_content_admin_write" on public.course_content;
create policy "course_content_admin_write" on public.course_content
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_content_student_select" on public.course_content;
create policy "course_content_student_select" on public.course_content
  for select using (status = 'PUBLISHED' and is_active and public.has_course_access(id));

-- course_weeks — student must see the whole chain (course + week) published
drop policy if exists "course_weeks_admin_write" on public.course_weeks;
create policy "course_weeks_admin_write" on public.course_weeks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_weeks_student_select" on public.course_weeks;
create policy "course_weeks_student_select" on public.course_weeks
  for select using (
    status = 'PUBLISHED'
    and is_active
    and public.has_course_access(course_id)
    and exists (
      select 1 from public.course_content c
      where c.id = course_id and c.status = 'PUBLISHED' and c.is_active
    )
  );

-- course_lessons — student must see the whole chain (course + week + lesson) published
drop policy if exists "course_lessons_admin_write" on public.course_lessons;
create policy "course_lessons_admin_write" on public.course_lessons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_lessons_student_select" on public.course_lessons;
create policy "course_lessons_student_select" on public.course_lessons
  for select using (
    status = 'PUBLISHED'
    and is_active
    and public.has_course_access(course_id)
    and exists (
      select 1 from public.course_weeks w
      where w.id = week_id and w.status = 'PUBLISHED' and w.is_active
    )
    and exists (
      select 1 from public.course_content c
      where c.id = course_id and c.status = 'PUBLISHED' and c.is_active
    )
  );

-- lesson_resources
drop policy if exists "lesson_resources_admin_write" on public.lesson_resources;
create policy "lesson_resources_admin_write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lesson_resources_student_select" on public.lesson_resources;
create policy "lesson_resources_student_select" on public.lesson_resources
  for select using (
    exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id
        and l.status = 'PUBLISHED'
        and l.is_active
        and public.has_course_access(l.course_id)
    )
  );

-- student_course_access — admin manages everything; a student may read
-- (never write) only their own rows, to render "My Courses".
drop policy if exists "student_course_access_admin_write" on public.student_course_access;
create policy "student_course_access_admin_write" on public.student_course_access
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student_course_access_self_select" on public.student_course_access;
create policy "student_course_access_self_select" on public.student_course_access
  for select using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

-- =========================================================
-- Grants — RLS restricts which rows; these grant the underlying verbs.
-- No anon access at all — this content is private, never public.
-- =========================================================

grant select, insert, update, delete on
  public.course_content, public.course_weeks, public.course_lessons,
  public.lesson_resources, public.student_course_access
  to authenticated;
