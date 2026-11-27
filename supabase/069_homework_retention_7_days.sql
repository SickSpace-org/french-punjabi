-- French Punjabi — Self Study and Assignments files now last 7 days, not 3.
-- Run this once in the Supabase SQL Editor, after 068_attendance_toronto_dates.sql.
--
-- Covers everything that set the 3-day lifetime in 065_self_study.sql and
-- 066_assignments.sql: the expiry trigger (shared by all four tables), the
-- column defaults, and the two cleanup helpers that pick which Storage files
-- to delete. Rows that are still live get 7 days from when they were
-- uploaded. Anything already past 3 days was deleted before this ran and
-- can't be brought back.

begin;

-- 1. New rows: the trigger sets the clock (students and admins can't change it).
create or replace function public.self_study_set_expiry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.expires_at := now() + interval '7 days';
  else
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;

alter table public.self_study_assignments  alter column expires_at set default now() + interval '7 days';
alter table public.self_study_submissions  alter column expires_at set default now() + interval '7 days';
alter table public.assignments             alter column expires_at set default now() + interval '7 days';
alter table public.assignment_submissions  alter column expires_at set default now() + interval '7 days';

-- 2. Rows that are still live: extend them to 7 days after upload. The expiry
--    trigger blocks changes to expires_at, so it's switched off just for this.
alter table public.self_study_assignments disable trigger self_study_assignments_expiry;
update public.self_study_assignments set expires_at = created_at + interval '7 days' where expires_at > now();
alter table public.self_study_assignments enable trigger self_study_assignments_expiry;

alter table public.self_study_submissions disable trigger self_study_submissions_expiry;
update public.self_study_submissions set expires_at = created_at + interval '7 days' where expires_at > now();
alter table public.self_study_submissions enable trigger self_study_submissions_expiry;

alter table public.assignments disable trigger assignments_expiry;
update public.assignments set expires_at = created_at + interval '7 days' where expires_at > now();
alter table public.assignments enable trigger assignments_expiry;

alter table public.assignment_submissions disable trigger assignment_submissions_expiry;
update public.assignment_submissions set expires_at = created_at + interval '7 days' where expires_at > now();
alter table public.assignment_submissions enable trigger assignment_submissions_expiry;

-- 3. Cleanup helpers: which Storage files the daily cleanup job deletes.
create or replace function public.self_study_expired_objects()
returns setof text
language sql
security definer
set search_path = public, storage
stable
as $$
  select name from storage.objects
  where bucket_id = 'self-study'
    and created_at < now() - interval '7 days';
$$;

revoke execute on function public.self_study_expired_objects() from public, anon, authenticated;
grant execute on function public.self_study_expired_objects() to service_role;

create or replace function public.assignments_expired_objects()
returns setof text
language sql
security definer
set search_path = public, storage
stable
as $$
  select name from storage.objects
  where bucket_id = 'assignments'
    and created_at < now() - interval '7 days';
$$;

revoke execute on function public.assignments_expired_objects() from public, anon, authenticated;
grant execute on function public.assignments_expired_objects() to service_role;

commit;
