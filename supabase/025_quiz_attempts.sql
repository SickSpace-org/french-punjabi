-- French Punjabi — Speaking quiz attempts: AI-graded pronunciation practice.
-- Run this once in the Supabase SQL Editor, after 024_student_test_slots.sql.
--
-- Each row is one graded speaking attempt: the AI-generated prompt the
-- student was asked to speak to, what Gemini heard (transcript), four 0-100
-- scores, and free-text strengths/improvements/feedback. The raw audio
-- recording itself is never stored — it's sent to Gemini for grading and
-- discarded, so no audio storage bucket is needed here. Rows are immutable
-- history: no update/delete policy is granted to anyone, matching how
-- attendance rows work (016_attendance.sql).

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  prompt text not null,
  transcript text not null,
  pronunciation_score smallint not null check (pronunciation_score between 0 and 100),
  fluency_score smallint not null check (fluency_score between 0 and 100),
  grammar_score smallint not null check (grammar_score between 0 and 100),
  overall_score smallint not null check (overall_score between 0 and 100),
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  feedback text not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_student_id_idx on public.quiz_attempts (student_id, created_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "quiz_attempts_admin_select" on public.quiz_attempts;
create policy "quiz_attempts_admin_select" on public.quiz_attempts
  for select using (public.is_admin());

drop policy if exists "quiz_attempts_self_select" on public.quiz_attempts;
create policy "quiz_attempts_self_select" on public.quiz_attempts
  for select using (
    exists (
      select 1 from public.students s
      where s.id = quiz_attempts.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "quiz_attempts_self_insert" on public.quiz_attempts;
create policy "quiz_attempts_self_insert" on public.quiz_attempts
  for insert with check (
    exists (
      select 1 from public.students s
      where s.id = quiz_attempts.student_id and s.auth_user_id = auth.uid()
    )
  );

-- No update/delete grants — attempts are immutable history.
