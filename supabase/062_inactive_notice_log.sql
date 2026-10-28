-- French Punjabi — 062: inactive_notice_log, the record of "we emailed this inactive student".
--
-- PLAIN LANGUAGE: one new table and nothing else. No existing table, column, policy or function is changed, and no function is
-- created. It is what the admin "Email N students" button on the Inactive Students page uses to
--   * skip anyone who was emailed in the last 30 days,
--   * show "last emailed" per student, and
--   * resume a send that was stopped part-way (a row stays 'pending' until its email is accepted by Resend).
-- Each row = one student in one send ("run"). status: pending -> sent | failed. Deleting a student deletes their rows.
--
-- Access (per the migration rule in RESUME-STRIPE.md section 11b): row-level security is ON, and access is revoked EXPLICITLY from
-- public, anon and authenticated (Supabase's default privileges would otherwise grant them). Signed-in users get SELECT back, and the
-- policy lets only admins (public.is_admin()) read. Nobody can write from the browser: the server writes with the service-role key,
-- after the server action has re-checked that the caller is an admin.
--
-- Safe to re-run: every statement is "if not exists" or "drop ... if exists".

create table if not exists public.inactive_notice_log (
  id              uuid        primary key default gen_random_uuid(),
  run_id          uuid        not null,                                             -- one id per click of "Email N students"
  student_id      uuid        not null references public.students (id) on delete cascade,
  status          text        not null default 'pending',
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,                                                      -- set when Resend accepted the email
  resend_email_id text,
  error           text,
  constraint inactive_notice_log_status_check check (status in ('pending', 'sent', 'failed')),
  constraint inactive_notice_log_run_student_key unique (run_id, student_id)
);

create index if not exists inactive_notice_log_student_sent_idx
  on public.inactive_notice_log (student_id, sent_at desc) where status = 'sent';
create index if not exists inactive_notice_log_run_status_idx
  on public.inactive_notice_log (run_id, status);

alter table public.inactive_notice_log enable row level security;

revoke all on table public.inactive_notice_log from public, anon, authenticated;
grant select on public.inactive_notice_log to authenticated;
grant all    on public.inactive_notice_log to service_role;

drop policy if exists inactive_notice_log_admin_read on public.inactive_notice_log;
create policy inactive_notice_log_admin_read on public.inactive_notice_log
  for select to authenticated using (public.is_admin());

-- No insert / update / delete policy exists for anyone: with RLS on, the browser (anon or signed in) can never write this table.

-- ROLLBACK (only before real use, because the table holds the send record):  drop table public.inactive_notice_log;
