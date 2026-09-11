# Speaking Quiz + Translator panel — design spec

Date: 2026-09-11

## Goal

Give students a self-serve way to practice spoken French and get AI feedback,
plus a quick English→French lookup tool, both inside the student portal.

## Scope (agreed with user)

- New page `/student/quiz` in the student portal, nav item "Speaking Quiz".
- Two panels: **Speaking Quiz** (main) and **Translator** (beside it).
- Quiz prompts: AI-generated fresh each time (no admin-managed prompt bank).
- Quiz attempts: transcript + scores + feedback are saved as history. The raw
  audio recording is **not** stored — graded once, then discarded.
- Translator: instant single lookup, no history.
- Out of scope for this pass: personalizing prompts to the student's
  phase/level, admin visibility into quiz history, retry/regenerate grading.

## Architecture

### Speaking Quiz flow

1. Page loads → student sees a speaking prompt and a "New Prompt" button.
2. "New Prompt" calls a server action that asks Gemini for a short, fresh
   TEF/TCF-style speaking topic (English instructions, e.g. "Describe your
   morning routine in French for 30–60 seconds").
3. Student clicks record (browser `MediaRecorder`, mic permission), then
   stops. A short `<audio>` playback lets them review before submitting.
4. On submit, the client **decodes the recording and re-encodes it as WAV**
   in-browser (Web Audio API `decodeAudioData` + a small manual PCM/WAV
   writer) before sending it to the server. See "Audio format" below for why.
5. A server action sends the WAV (base64) + the original prompt to Gemini via
   `generateObject`, in a single multimodal call that both transcribes and
   grades the attempt against a rubric (see "Grading schema").
6. The server action inserts the result into `quiz_attempts` and returns it
   to the client, which renders a result card (scores, transcript, strengths,
   improvements, feedback).
7. The page's history section (last 10 attempts, fetched server-side on page
   load) shows past prompts, dates, and overall scores.

### Translator flow

Single input box → server action calls Gemini for a translation + one
example sentence → rendered inline. No persistence.

## Audio format

Browsers record mic audio as WebM/Opus by default. Gemini's documented
audio-understanding formats are WAV, MP3, AIFF, AAC, OGG, and FLAC — WebM is
not listed. Rather than assume undocumented behavior works, the client
converts the recording to WAV before upload. This is a well-established
browser-only technique (no server round-trip, no native deps):
`AudioContext.decodeAudioData` on the recorded blob, then a small helper
writes 16-bit PCM samples into a WAV container.

This will be verified end-to-end before considering the feature done (see
Testing).

## Grading schema

Single Gemini call via `generateObject`, model `gemini-flash-lite-latest`
(same quota-safe model already used by the chat widget), schema:

```ts
z.object({
  transcript: z.string(),                 // what the model heard, in French
  pronunciationScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),      // specific, actionable tips
  feedback: z.string(),                   // short encouraging summary
})
```

The rubric prompt instructs the model to grade a TEF/TCF-style speaking
attempt: pronunciation accuracy, fluency/pace, and grammar, all in the
context of a language learner (not a native speaker), with concrete,
actionable pronunciation tips (not just "practice more").

## Data model

New migration `supabase/025_quiz_attempts.sql`, following the same
admin/self RLS pattern already used by `attendance` (`016_attendance.sql`):

```sql
create table public.quiz_attempts (
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

create index quiz_attempts_student_id_idx on public.quiz_attempts (student_id, created_at desc);

alter table public.quiz_attempts enable row level security;

-- admin_select: public.is_admin()
-- self_select: exists (select 1 from students s where s.id = quiz_attempts.student_id and s.auth_user_id = auth.uid())
-- self_insert: same shape as self_select, using with check instead of using,
--   so a student can only ever insert a row whose student_id is their own.
--   No update/delete grants — attempts are immutable history.
```

The insert happens via the server action using the request-scoped Supabase
client (already authenticated as the student through cookies, same as every
other student mutation in this app) — RLS enforces the student can't write a
row for anyone but themselves, so the server action doesn't need to be a
security-definer RPC the way `mark_class_attendance` is.

## New files

- `supabase/025_quiz_attempts.sql` — table + RLS (above).
- `src/types/database.ts` — add `QuizAttemptRow` type.
- `src/lib/quiz/schema.ts` — the zod grading schema + its inferred type,
  shared between the server action and any client rendering code.
- `src/lib/quiz/gradeSpeaking.ts` — server-only: builds the rubric prompt,
  calls `generateObject` with the WAV file part, returns a parsed result.
- `src/lib/quiz/generatePrompt.ts` — server-only: asks Gemini for a fresh
  speaking topic (`generateText`, short output).
- `src/lib/quiz/translate.ts` — server-only: asks Gemini for a translation +
  example sentence (`generateObject`, tiny schema).
- `src/lib/quiz/getQuizHistory.ts` — fetches the current student's last 10
  `quiz_attempts` rows (mirrors `getAdminAttendance.ts` / similar lib style).
- `src/app/student/(portal)/quiz/actions.ts` — `"use server"` actions:
  `generateQuizPrompt()`, `submitSpeakingAttempt(prompt, wavBase64)`,
  `translateWord(text)`.
- `src/app/student/(portal)/quiz/page.tsx` — server component: fetches
  history, renders the two client panels.
- `src/components/student/SpeakingQuiz.tsx` — client: prompt, recording
  UI, submission, result card, history list.
- `src/components/student/Translator.tsx` — client: input, translate
  button, result box.
- `src/lib/audio/encodeWav.ts` — client-safe helper: `Blob -> Promise<Blob>`
  (WebM/whatever the browser recorded → WAV), used only in the browser.
- Edit `src/components/student/StudentShell.tsx` — add nav entry
  `{ label: "Speaking Quiz", href: "/student/quiz", icon: Mic }`.

## Error handling

- Mic permission denied → inline message, no crash.
- Grading call fails (quota/network) → result card shows a retry-able error
  state, same pattern as the chat widget's error+retry UI. The attempt is
  simply not saved if grading fails (nothing partial is written).
- Empty/silent recording → the model will likely produce a low score and a
  transcript noting it couldn't hear speech; no special-cased handling needed
  since the schema always returns *something* gradeable.

## Testing (no automated suite exists in this repo)

Same manual-verification approach used for the chat feature:
1. Generate a real short WAV test clip locally (Windows built-in
   text-to-speech via PowerShell, scripted, no browser needed) and run it
   through `gradeSpeaking.ts` directly to confirm Gemini accepts WAV input
   and returns a well-formed structured grade.
2. `tsc --noEmit` and `eslint` clean.
3. Apply the migration against the real Supabase project and confirm RLS
   (student can insert/read own rows; cannot read another student's rows).
4. Ask the user to record their own voice on the live site and confirm the
   full flow before calling this done.
