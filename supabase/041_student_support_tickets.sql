-- French Punjabi — Teacher Portal extension, Phase 8: "Talk to Admin"
-- student support tickets. Run after 040_admin_messages.sql.
--
-- NEW TABLES, not an extension of student_feedback_notes (037) or
-- lesson_comments (008) — checked both directly before deciding, same
-- process as every extend-vs-new decision in this project.
--  - lesson_comments is a shared per-lesson room (any student with course
--    access sees the whole thread) — wrong privacy model; a ticket is
--    private to one student + admin.
--  - student_feedback_notes is private (right privacy model) but its
--    one-level-nesting trigger was built for a FIXED direction (teacher
--    writes the root, student replies) and a capped depth. A real support
--    conversation needs genuine back-and-forth (student asks, admin
--    replies, student follows up again) — capping at one admin reply
--    would feel broken, not simplified. So this is a flat message list
--    per ticket instead, which is actually SIMPLER than 037's design, not
--    more complex: no nesting-depth trigger needed at all, since there is
--    no "reply to a specific message" structure, just a chronological
--    conversation.
--
-- Confirmed design decisions:
--  - Full thread (not one-shot Q&A) — a student can send more than one
--    message per ticket, and so can admin.
--  - A student may open more than one ticket (not forced into one eternal
--    thread) — same schema cost either way, closer to normal support-
--    ticket UX.
--  - Ticket creation (ticket row + first message) goes through a small
--    RPC for atomicity — same reasoning as every other multi-row write in
--    this project. A REPLY on an existing ticket (either side) is a
--    single-row insert, so a direct RLS-gated insert is enough — no RPC,
--    consistent with how admin already writes directly everywhere else,
--    and how a student's reply to a feedback note (037) works.
--  - Sending a new STUDENT message on a RESOLVED ticket reopens it to
--    OPEN automatically (handled by the trigger below) — admin replying
--    does not change status either way; only admin explicitly marks a
--    ticket RESOLVED.

-- =========================================================
-- Tables
-- =========================================================

create table public.student_support_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_support_tickets_student_id_idx on public.student_support_tickets (student_id);
create index student_support_tickets_status_idx on public.student_support_tickets (status);

drop trigger if exists set_updated_at on public.student_support_tickets;
create trigger set_updated_at before update on public.student_support_tickets
  for each row execute function public.set_updated_at();

-- One row per message, flat — no parent/reply structure at all (contrast
-- with student_feedback_notes). is_read means "has the OTHER party seen
-- this": for a student-authored message, has admin read it; for an
-- admin-authored message, has the student read it.
create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.student_support_tickets (id) on delete cascade,
  sender_type text not null check (sender_type in ('student', 'admin')),
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_id_idx on public.support_ticket_messages (ticket_id);

-- =========================================================
-- touch_ticket_on_new_message() — bumps the parent ticket's updated_at on
-- every new message (so admin's ticket list can sort by "most recently
-- active"), and auto-reopens a RESOLVED ticket when the STUDENT sends a
-- new message on it (an admin reply never changes status — only an
-- explicit admin action does that, via a plain direct update since admin
-- already has full write access to student_support_tickets below).
-- =========================================================

create or replace function public.touch_ticket_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.student_support_tickets
  set updated_at = now(),
      status = case when new.sender_type = 'student' then 'OPEN' else status end
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists touch_ticket_on_new_message on public.support_ticket_messages;
create trigger touch_ticket_on_new_message after insert on public.support_ticket_messages
  for each row execute function public.touch_ticket_on_new_message();

-- =========================================================
-- is_own_ticket() — the student-side ownership check for
-- support_ticket_messages, which has no student_id column of its own
-- (only ticket_id). plpgsql from the start, same reasoning as every
-- cross-table RLS helper since 033_fix_teacher_rls_recursion.sql — never
-- inline a raw cross-table subquery directly in a policy.
-- =========================================================

create or replace function public.is_own_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.student_support_tickets t
    where t.id = p_ticket_id and public.is_own_student_id(t.student_id)
  );
end;
$$;

grant execute on function public.is_own_ticket(uuid) to authenticated;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.student_support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "student_support_tickets_admin_write" on public.student_support_tickets;
create policy "student_support_tickets_admin_write" on public.student_support_tickets
  for all using (public.is_admin()) with check (public.is_admin());

-- Student: read their own tickets. No insert policy here at all — a new
-- ticket is only ever created via student_open_ticket() below, which
-- bypasses RLS as the function owner.
drop policy if exists "student_support_tickets_student_select" on public.student_support_tickets;
create policy "student_support_tickets_student_select" on public.student_support_tickets
  for select using (public.is_own_student_id(student_id));

drop policy if exists "support_ticket_messages_admin_write" on public.support_ticket_messages;
create policy "support_ticket_messages_admin_write" on public.support_ticket_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- Student: read every message on a ticket they own (both their own sent
-- messages and admin's replies).
drop policy if exists "support_ticket_messages_student_select" on public.support_ticket_messages;
create policy "support_ticket_messages_student_select" on public.support_ticket_messages
  for select using (public.is_own_ticket(ticket_id));

-- Student: insert a reply onto a ticket they own, sender_type forced to
-- 'student' — never spoofable to 'admin' from a student session.
drop policy if exists "support_ticket_messages_student_insert" on public.support_ticket_messages;
create policy "support_ticket_messages_student_insert" on public.support_ticket_messages
  for insert with check (
    sender_type = 'student'
    and public.is_own_ticket(ticket_id)
  );

-- Student: mark a message read (same "self can mark read, nothing else"
-- shape as notifications_self_update / teacher_messages_student_update —
-- app code only ever sends {is_read: true}, same existing precedent, not
-- a new column-level restriction pattern).
drop policy if exists "support_ticket_messages_student_update" on public.support_ticket_messages;
create policy "support_ticket_messages_student_update" on public.support_ticket_messages
  for update using (public.is_own_ticket(ticket_id)) with check (public.is_own_ticket(ticket_id));

grant select on public.student_support_tickets to authenticated;
grant select, insert, update on public.support_ticket_messages to authenticated;

-- =========================================================
-- student_open_ticket() — the ONLY way a new ticket is created. Atomic:
-- the ticket row and its first message are written together, so a
-- partial failure never leaves an empty, message-less ticket behind.
-- =========================================================

create or replace function public.student_open_ticket(p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_ticket_id uuid;
begin
  select id into v_student_id from public.students where auth_user_id = auth.uid() and status = 'ACTIVE';
  if v_student_id is null then
    raise exception 'not authorized';
  end if;
  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'subject is required';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'message body is required';
  end if;

  v_ticket_id := gen_random_uuid();

  insert into public.student_support_tickets (id, student_id, subject, status)
  values (v_ticket_id, v_student_id, trim(p_subject), 'OPEN');

  insert into public.support_ticket_messages (ticket_id, sender_type, body)
  values (v_ticket_id, 'student', trim(p_body));

  return v_ticket_id;
end;
$$;

grant execute on function public.student_open_ticket(text, text) to authenticated;
