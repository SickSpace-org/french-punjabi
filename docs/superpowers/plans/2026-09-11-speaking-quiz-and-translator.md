# Speaking Quiz + Translator Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/student/quiz` page to the student portal with an AI-graded speaking practice quiz and an instant English→French translator beside it.

**Architecture:** A student records themselves speaking to an AI-generated prompt; the recording is converted to WAV in-browser and sent to Gemini (`gemini-flash-lite-latest`) in one multimodal `generateObject` call that transcribes and grades it; the result is saved to a new `quiz_attempts` table and shown to the student. The translator is a separate, stateless server action call to the same model, no persistence. Everything is wired through Next.js Server Actions, matching every other student-portal mutation in this codebase (`src/app/student/actions.ts`).

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS + `@supabase/ssr`), Vercel AI SDK (`ai`, `@ai-sdk/google`), zod, browser `MediaRecorder` + Web Audio API.

**Spec:** `docs/superpowers/specs/2026-09-11-speaking-quiz-and-translator-design.md`

## Global Constraints

- No audio file is ever stored — only the AI-produced transcript, scores, and feedback (per spec's "Audio storage" decision).
- Client always converts recordings to WAV before sending to the server — never send WebM to Gemini (per spec's "Audio format" risk).
- Every student-facing mutation must independently re-resolve the caller via `getCurrentStudent(supabase)` and let RLS be the real authorization boundary — never trust a `student_id` passed from the client (existing codebase convention, see `src/app/student/actions.ts:9-15`).
- Model: `gemini-flash-lite-latest` for every AI call in this feature (prompt generation, grading, translation) — same quota-safe model already used by the chat widget.
- No automated test suite exists in this repo. Verification is manual: real Gemini API calls, `tsc --noEmit`, `eslint`, and (for the DB) a live query against the real Supabase project.

---

### Task 1: Database migration + row types

**Files:**
- Create: `supabase/025_quiz_attempts.sql`
- Modify: `src/types/database.ts` (add `QuizAttemptRow` type near `AttendanceRow` at line 79, and a `quiz_attempts` entry in `Database.public.Tables` near the `attendance` entry at line 469)

**Interfaces:**
- Produces: `QuizAttemptRow` type — `{ id: string; student_id: string; prompt: string; transcript: string; pronunciation_score: number; fluency_score: number; grammar_score: number; overall_score: number; strengths: string[]; improvements: string[]; feedback: string; created_at: string }`, exported from `src/types/database.ts`, consumed by Task 3 and Task 6.
- Produces: `public.quiz_attempts` Postgres table with RLS policies `quiz_attempts_admin_select`, `quiz_attempts_self_select`, `quiz_attempts_self_insert`.

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Add `QuizAttemptRow` to `src/types/database.ts`**

Insert immediately after the `AttendanceRow` type (after its closing `};` at line 79):

```ts
export type QuizAttemptRow = {
  id: string;
  student_id: string;
  prompt: string;
  transcript: string;
  pronunciation_score: number;
  fluency_score: number;
  grammar_score: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
  created_at: string;
};
```

- [ ] **Step 3: Register the table in `Database.public.Tables`**

Insert immediately after the `attendance:` entry (which ends at line 473, right before `test_slots:`):

```ts
      quiz_attempts: TableDef<
        QuizAttemptRow,
        Omit<QuizAttemptRow, "id" | "created_at" | "strengths" | "improvements"> & {
          id?: string;
          created_at?: string;
          strengths?: string[];
          improvements?: string[];
        },
        Partial<Omit<QuizAttemptRow, "id" | "student_id" | "created_at">>
      >;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Apply the migration**

This is a real production schema change (additive — a new table, nothing existing is touched), so it needs a human or explicit approval, matching how every prior migration in this repo (see the header comments in `016_attendance.sql`, `023_test_slots.sql`) was applied: paste `supabase/025_quiz_attempts.sql` into the Supabase Dashboard's SQL Editor for this project and run it. Confirm success (no errors, `quiz_attempts` table now visible in the Table Editor) before moving on — later tasks' verification steps depend on this table existing.

- [ ] **Step 6: Commit**

```bash
git add supabase/025_quiz_attempts.sql src/types/database.ts
git commit -m "Add quiz_attempts table and QuizAttemptRow type"
```

---

### Task 2: Gemini wrappers — grading schema, prompt generator, grader, translator

**Files:**
- Create: `src/lib/quiz/schema.ts`
- Create: `src/lib/quiz/generatePrompt.ts`
- Create: `src/lib/quiz/gradeSpeaking.ts`
- Create: `src/lib/quiz/translate.ts`
- Modify: `package.json` (add `zod` dependency)

**Interfaces:**
- Consumes: `google` from `@ai-sdk/google`, `generateText`/`generateObject` from `ai` (already installed, see `src/app/api/chat/route.ts`).
- Produces: `quizGradeSchema` (zod schema) and `QuizGrade` type from `src/lib/quiz/schema.ts`.
- Produces: `generateSpeakingPrompt(): Promise<string>` from `src/lib/quiz/generatePrompt.ts`.
- Produces: `gradeSpeaking(prompt: string, wavBase64: string): Promise<QuizGrade>` from `src/lib/quiz/gradeSpeaking.ts`.
- Produces: `translateWord(text: string): Promise<Translation>` and `Translation` type from `src/lib/quiz/translate.ts`.
- All four are consumed by Task 4's server actions.

- [ ] **Step 1: Install zod**

Run: `npm install zod`
Expected: `zod` appears under `dependencies` in `package.json` (it was previously only a transitive peer dependency, not a direct one — `generateObject` needs it imported directly in our code).

- [ ] **Step 2: Write the grading schema**

Create `src/lib/quiz/schema.ts`:

```ts
import { z } from "zod";

export const quizGradeSchema = z.object({
  transcript: z.string().describe("Exactly what the student said, transcribed in French."),
  pronunciationScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).describe("2-4 specific things the student did well."),
  improvements: z
    .array(z.string())
    .describe("2-4 specific, actionable tips — exact sounds or grammar points to fix, not generic advice."),
  feedback: z.string().describe("A short, encouraging 2-3 sentence summary."),
});

export type QuizGrade = z.infer<typeof quizGradeSchema>;
```

- [ ] **Step 3: Write the prompt generator**

Create `src/lib/quiz/generatePrompt.ts`:

```ts
import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const INSTRUCTIONS = `You write short speaking-practice prompts for a French-language learner preparing for the TEF/TCF Canada exam. Generate ONE fresh topic instruction in English, telling the student what to talk about in French for about 30-60 seconds. Keep it beginner-to-intermediate friendly (everyday topics: routines, family, hobbies, travel, food, opinions). Return ONLY the instruction sentence, nothing else — no quotes, no preamble.`;

export async function generateSpeakingPrompt(): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt: INSTRUCTIONS,
  });
  return text.trim();
}
```

- [ ] **Step 4: Write the grader**

Create `src/lib/quiz/gradeSpeaking.ts`:

```ts
import "server-only";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { quizGradeSchema, type QuizGrade } from "./schema";

const RUBRIC = `You are a French pronunciation and speaking examiner grading a language learner's practice recording for TEF/TCF Canada exam preparation — NOT a native speaker, so grade with that in mind. You will hear an audio recording of the student responding to a speaking prompt.

Listen to the recording and:
1. Transcribe exactly what the student said, in French.
2. Score pronunciation (accent accuracy, individual sound production), fluency (pace, hesitation, flow), and grammar (verb conjugation, agreement, sentence structure), each 0-100.
3. Give an overall score 0-100.
4. List 2-4 specific strengths.
5. List 2-4 specific, actionable improvements — name the exact sound, word, or grammar point to fix, not generic advice like "practice more."
6. Write a short, encouraging 2-3 sentence feedback summary.

If the recording is silent, inaudible, or not French speech, say so plainly in the transcript and score accordingly (low scores, feedback explaining why).`;

export async function gradeSpeaking(prompt: string, wavBase64: string): Promise<QuizGrade> {
  const { object } = await generateObject({
    model: google("gemini-flash-lite-latest"),
    schema: quizGradeSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${RUBRIC}\n\nThe student was asked to: "${prompt}"` },
          { type: "file", mediaType: "audio/wav", data: wavBase64 },
        ],
      },
    ],
  });

  return object;
}
```

- [ ] **Step 5: Write the translator**

Create `src/lib/quiz/translate.ts`:

```ts
import "server-only";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const translationSchema = z.object({
  translation: z.string().describe("The French translation."),
  example: z
    .string()
    .describe("One short example sentence in French using it, with an English gloss in parentheses."),
});

export type Translation = z.infer<typeof translationSchema>;

export async function translateWord(text: string): Promise<Translation> {
  const { object } = await generateObject({
    model: google("gemini-flash-lite-latest"),
    schema: translationSchema,
    prompt: `Translate this English word or phrase into French: "${text}". If it has multiple common translations, give the most common one.`,
  });

  return object;
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/quiz`
Expected: no errors.

- [ ] **Step 7: Verify `generateSpeakingPrompt` and `translateWord` against the real API**

These two don't need audio, so verify them first with a throwaway script. The real `src/lib/quiz/*.ts` files can't be imported directly by plain `node` (TypeScript + the `server-only` guard), so this script inlines the same calls to hit the real API and eyeball the output. Create a temporary file `verify-quiz-text.mjs` in the project root:

```js
import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";

const { text } = await generateText({
  model: google("gemini-flash-lite-latest"),
  prompt: `You write short speaking-practice prompts for a French-language learner preparing for the TEF/TCF Canada exam. Generate ONE fresh topic instruction in English, telling the student what to talk about in French for about 30-60 seconds. Keep it beginner-to-intermediate friendly (everyday topics: routines, family, hobbies, travel, food, opinions). Return ONLY the instruction sentence, nothing else — no quotes, no preamble.`,
});
console.log("PROMPT:", text.trim());

const { object } = await generateObject({
  model: google("gemini-flash-lite-latest"),
  schema: z.object({ translation: z.string(), example: z.string() }),
  prompt: `Translate this English word or phrase into French: "good morning". If it has multiple common translations, give the most common one.`,
});
console.log("TRANSLATION:", JSON.stringify(object));
```

Run: `GOOGLE_GENERATIVE_AI_API_KEY="<value from .env.local>" node verify-quiz-text.mjs`
Expected: prints a plausible English speaking-topic sentence, then `TRANSLATION: {"translation":"Bonjour" or "Bon matin",...}`.

Delete `verify-quiz-text.mjs` once confirmed (it's a throwaway script, not part of the codebase).

- [ ] **Step 8: Verify `gradeSpeaking` against a real WAV file**

Generate a real short WAV test clip using Windows' built-in text-to-speech (no browser or mic needed):

```powershell
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile("$PWD\test-speech.wav")
$synth.Speak("Bonjour, je m'appelle Marie et j'habite a Montreal.")
$synth.Dispose()
```

Then create `verify-quiz-grade.mjs` in the project root:

```js
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "node:fs";

const schema = z.object({
  transcript: z.string(),
  pronunciationScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  feedback: z.string(),
});

const wavBase64 = fs.readFileSync("./test-speech.wav").toString("base64");

const { object } = await generateObject({
  model: google("gemini-flash-lite-latest"),
  schema,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: `Transcribe this French audio and grade it as a TEF/TCF speaking attempt (pronunciation, fluency, grammar, 0-100 each, plus overall, strengths, improvements, feedback).` },
        { type: "file", mediaType: "audio/wav", data: wavBase64 },
      ],
    },
  ],
});

console.log(JSON.stringify(object, null, 2));
```

Run: `GOOGLE_GENERATIVE_AI_API_KEY="<value from .env.local>" node verify-quiz-grade.mjs`
Expected: valid JSON matching the schema, with a `transcript` that resembles "Bonjour, je m'appelle Marie et j'habite à Montréal" (synthesized TTS pronunciation won't be perfect, so scores may be mediocre — that's fine, the goal is confirming Gemini accepts the WAV and returns well-formed structured output, not that the score is high).

If this step fails with a format/decode error, the audio format assumption is wrong and needs investigation before proceeding to Task 5 (client WAV encoding) — do not skip this check.

Delete `verify-quiz-grade.mjs` and `test-speech.wav` once confirmed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/quiz/schema.ts src/lib/quiz/generatePrompt.ts src/lib/quiz/gradeSpeaking.ts src/lib/quiz/translate.ts
git commit -m "Add Gemini wrappers for quiz prompts, grading, and translation"
```

---

### Task 3: Quiz history fetcher

**Files:**
- Create: `src/lib/quiz/getQuizHistory.ts`

**Interfaces:**
- Consumes: `QuizAttemptRow`, `Database` from `@/types/database` (Task 1).
- Produces: `getQuizHistory(supabase: SupabaseClient<Database>, studentId: string, limit?: number): Promise<QuizAttemptRow[]>`, consumed by Task 8's page.

- [ ] **Step 1: Write the fetcher**

Create `src/lib/quiz/getQuizHistory.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QuizAttemptRow } from "@/types/database";

export async function getQuizHistory(
  supabase: SupabaseClient<Database>,
  studentId: string,
  limit = 10
): Promise<QuizAttemptRow[]> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This won't be runtime-verified until Task 9, since it needs a real logged-in student session with rows in the table.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz/getQuizHistory.ts
git commit -m "Add getQuizHistory for the student quiz page"
```

---

### Task 4: Server actions

**Files:**
- Create: `src/app/student/(portal)/quiz/actions.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `getCurrentStudent` from `@/lib/student/getCurrentStudent`, `generateSpeakingPrompt`/`gradeSpeaking`/`translateWord` from Task 2.
- Produces: `requestQuizPrompt(): Promise<PromptResult>`, `submitSpeakingAttempt(prompt: string, wavBase64: string): Promise<GradeResult>`, `requestTranslation(text: string): Promise<TranslateResult>` — all consumed by Task 6 and Task 7's client components.

- [ ] **Step 1: Write the server actions**

Create `src/app/student/(portal)/quiz/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { generateSpeakingPrompt } from "@/lib/quiz/generatePrompt";
import { gradeSpeaking } from "@/lib/quiz/gradeSpeaking";
import { translateWord } from "@/lib/quiz/translate";
import type { QuizGrade } from "@/lib/quiz/schema";
import type { Translation } from "@/lib/quiz/translate";

export type PromptResult = { ok: true; prompt: string } | { ok: false; error: string };

export async function requestQuizPrompt(): Promise<PromptResult> {
  try {
    const prompt = await generateSpeakingPrompt();
    return { ok: true, prompt };
  } catch {
    return { ok: false, error: "Couldn't generate a prompt. Please try again." };
  }
}

export type GradeResult = { ok: true; grade: QuizGrade } | { ok: false; error: string };

/**
 * Grades even if saving history fails — a Gemini hiccup on the insert
 * shouldn't hide a result the student already waited for.
 */
export async function submitSpeakingAttempt(prompt: string, wavBase64: string): Promise<GradeResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  let grade: QuizGrade;
  try {
    grade = await gradeSpeaking(prompt, wavBase64);
  } catch {
    return { ok: false, error: "Grading failed. Please try again." };
  }

  const { error } = await supabase.from("quiz_attempts").insert({
    student_id: student.id,
    prompt,
    transcript: grade.transcript,
    pronunciation_score: Math.round(grade.pronunciationScore),
    fluency_score: Math.round(grade.fluencyScore),
    grammar_score: Math.round(grade.grammarScore),
    overall_score: Math.round(grade.overallScore),
    strengths: grade.strengths,
    improvements: grade.improvements,
    feedback: grade.feedback,
  });

  if (error) console.error("[quiz] Failed to save attempt:", error);

  revalidatePath("/student/quiz");
  return { ok: true, grade };
}

export type TranslateResult = { ok: true; translation: Translation } | { ok: false; error: string };

export async function requestTranslation(text: string): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Type a word or phrase first." };

  try {
    const translation = await translateWord(trimmed);
    return { ok: true, translation };
  } catch {
    return { ok: false, error: "Translation failed. Please try again." };
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "src/app/student/(portal)/quiz"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/student/(portal)/quiz/actions.ts"
git commit -m "Add quiz server actions for prompt, grading, and translation"
```

---

### Task 5: Client-side WAV encoder

**Files:**
- Create: `src/lib/audio/encodeWav.ts`

**Interfaces:**
- Produces: `blobToWav(blob: Blob): Promise<Blob>` and `blobToBase64(blob: Blob): Promise<string>`, both browser-only, consumed by Task 6.

- [ ] **Step 1: Write the encoder**

Create `src/lib/audio/encodeWav.ts`:

```ts
/**
 * Converts any browser-recorded audio Blob (typically WebM/Opus from
 * MediaRecorder) into a mono 16-bit PCM WAV Blob — a format Gemini's audio
 * understanding officially supports, unlike WebM. Runs entirely client-side
 * via the Web Audio API, no server round-trip.
 */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData =
    audioBuffer.numberOfChannels > 1 ? mixDownToMono(audioBuffer) : audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  await audioContext.close();

  const pcmData = floatTo16BitPCM(channelData);
  return writeWavHeader(pcmData, 1, sampleRate);
}

function mixDownToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mixed = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      mixed[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return mixed;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function writeWavHeader(pcmData: Int16Array, numChannels: number, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Blob -> base64 string (no `data:` prefix), for sending to a server action. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Runtime-verified in Task 9 as part of the full browser flow — `AudioContext` doesn't exist in Node, so this can't be unit-tested outside a browser.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/audio/encodeWav.ts
git commit -m "Add client-side WebM-to-WAV audio encoder"
```

---

### Task 6: Speaking Quiz component

**Files:**
- Create: `src/components/student/SpeakingQuiz.tsx`

**Interfaces:**
- Consumes: `requestQuizPrompt`, `submitSpeakingAttempt` (Task 4); `blobToWav`, `blobToBase64` (Task 5); `QuizGrade` type (Task 2); `QuizAttemptRow` type (Task 1).
- Produces: `<SpeakingQuiz history={QuizAttemptRow[]} />`, consumed by Task 8's page.

- [ ] **Step 1: Write the component**

Create `src/components/student/SpeakingQuiz.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, RefreshCw } from "lucide-react";
import { requestQuizPrompt, submitSpeakingAttempt } from "@/app/student/(portal)/quiz/actions";
import { blobToWav, blobToBase64 } from "@/lib/audio/encodeWav";
import type { QuizGrade } from "@/lib/quiz/schema";
import type { QuizAttemptRow } from "@/types/database";

type Status = "idle" | "recording" | "recorded" | "grading";

export default function SpeakingQuiz({ history }: { history: QuizAttemptRow[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);

  async function loadPrompt() {
    setPromptLoading(true);
    setError(null);
    const result = await requestQuizPrompt();
    setPromptLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPrompt(result.prompt);
    setStatus("idle");
    setAudioUrl(null);
    setGrade(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recordedBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Couldn't access your microphone. Please allow mic access and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function submitRecording() {
    if (!recordedBlobRef.current || !prompt) return;
    setStatus("grading");
    setError(null);

    try {
      const wavBlob = await blobToWav(recordedBlobRef.current);
      const wavBase64 = await blobToBase64(wavBlob);
      const result = await submitSpeakingAttempt(prompt, wavBase64);

      if (!result.ok) {
        setError(result.error);
        setStatus("recorded");
        return;
      }

      setGrade(result.grade);
      setStatus("idle");
      router.refresh();
    } catch {
      setError("Something went wrong processing your recording. Please try again.");
      setStatus("recorded");
    }
  }

  function reRecord() {
    setAudioUrl(null);
    setGrade(null);
    setStatus("idle");
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy">Speaking Quiz</h2>
      <p className="mt-1 text-sm text-navy/60">
        Get an AI-generated topic, record yourself speaking French, and get instant feedback.
      </p>

      <div className="mt-4 rounded-xl bg-cream-dim p-4">
        {prompt ? (
          <p className="text-sm font-medium text-navy">{prompt}</p>
        ) : (
          <p className="text-sm text-navy/50">Click below to get a speaking prompt.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadPrompt}
          disabled={promptLoading || status === "recording" || status === "grading"}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:bg-cream-dim disabled:opacity-40"
        >
          {promptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          New Prompt
        </button>

        {prompt && status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
        )}

        {status === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        )}
      </div>

      {audioUrl && (status === "recorded" || status === "grading") && (
        <div className="mt-4 space-y-3">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={submitRecording}
              disabled={status === "grading"}
              className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark disabled:opacity-40"
            >
              {status === "grading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {status === "grading" ? "Grading…" : "Submit for Grading"}
            </button>
            <button
              type="button"
              onClick={reRecord}
              disabled={status === "grading"}
              className="rounded-xl border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-dim disabled:opacity-40"
            >
              Re-record
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red">{error}</p>}

      {grade && (
        <div className="mt-6 rounded-xl border border-navy/10 bg-cream-dim p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-2xl font-bold text-navy">{Math.round(grade.overallScore)}/100</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Overall</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.pronunciationScore)}</p>
              <p className="text-xs text-navy/50">Pronunciation</p>
            </div>
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.fluencyScore)}</p>
              <p className="text-xs text-navy/50">Fluency</p>
            </div>
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.grammarScore)}</p>
              <p className="text-xs text-navy/50">Grammar</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-navy/70">
            <span className="font-semibold text-navy">You said:</span> {grade.transcript}
          </p>
          <p className="mt-3 text-sm text-navy/80">{grade.feedback}</p>
          {grade.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Strengths</p>
              <ul className="mt-1 list-inside list-disc text-sm text-navy/70">
                {grade.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {grade.improvements.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">To Improve</p>
              <ul className="mt-1 list-inside list-disc text-sm text-navy/70">
                {grade.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Recent Attempts</p>
          <ul className="mt-2 divide-y divide-navy/10">
            {history.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate pr-3 text-navy/70">{attempt.prompt}</span>
                <span className="shrink-0 font-semibold text-navy">{attempt.overall_score}/100</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/student/SpeakingQuiz.tsx`
Expected: no errors — the import of `@/app/student/(portal)/quiz/actions` already resolves at this point since Task 4 created that file (Next.js route groups like `(portal)` are real directories on disk, just excluded from the URL).

- [ ] **Step 3: Commit**

```bash
git add src/components/student/SpeakingQuiz.tsx
git commit -m "Add SpeakingQuiz client component"
```

---

### Task 7: Translator component

**Files:**
- Create: `src/components/student/Translator.tsx`

**Interfaces:**
- Consumes: `requestTranslation` (Task 4), `Translation` type (Task 2).
- Produces: `<Translator />`, consumed by Task 8's page.

- [ ] **Step 1: Write the component**

Create `src/components/student/Translator.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { requestTranslation } from "@/app/student/(portal)/quiz/actions";
import type { Translation } from "@/lib/quiz/translate";

export default function Translator() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Translation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setError(null);
    const response = await requestTranslation(text);
    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      setResult(null);
      return;
    }
    setResult(response.translation);
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
        <Languages className="h-5 w-5" />
        Translator
      </h2>
      <p className="mt-1 text-sm text-navy/60">Look up any English word or phrase in French.</p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="e.g. good morning"
          className="flex-1 rounded-xl border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-red/50"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Translate"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl bg-cream-dim p-4">
          <p className="font-display text-lg font-bold text-navy">{result.translation}</p>
          <p className="mt-1 text-sm text-navy/60">{result.example}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/student/Translator.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/student/Translator.tsx
git commit -m "Add Translator client component"
```

---

### Task 8: Quiz page + navigation entry

**Files:**
- Create: `src/app/student/(portal)/quiz/page.tsx`
- Modify: `src/components/student/StudentShell.tsx:6` (add `Mic` to the lucide-react import) and `:13` (add a nav entry after `"Test"`)

**Interfaces:**
- Consumes: `getCurrentStudent` (existing), `getQuizHistory` (Task 3), `SpeakingQuiz` (Task 6), `Translator` (Task 7).
- Produces: the `/student/quiz` route, reachable from the sidebar.

- [ ] **Step 1: Write the page**

Create `src/app/student/(portal)/quiz/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getQuizHistory } from "@/lib/quiz/getQuizHistory";
import SpeakingQuiz from "@/components/student/SpeakingQuiz";
import Translator from "@/components/student/Translator";

export const revalidate = 0;

export default async function StudentQuizPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  const history = await getQuizHistory(supabase, student.id);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <SpeakingQuiz history={history} />
      <Translator />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav entry**

In `src/components/student/StudentShell.tsx`, change the import line:

```ts
import { Bell, BookOpen, CalendarCheck, CalendarClock, LayoutDashboard, Menu, Mic, User, X } from "lucide-react";
```

And insert into `NAV_ITEMS`, right after the `"Test"` entry:

```ts
  { label: "Test", href: "/student/test", icon: CalendarClock },
  { label: "Speaking Quiz", href: "/student/quiz", icon: Mic },
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "src/app/student/(portal)/quiz/page.tsx" src/components/student/StudentShell.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/student/(portal)/quiz/page.tsx" src/components/student/StudentShell.tsx
git commit -m "Add /student/quiz page and sidebar nav entry"
```

---

### Task 9: End-to-end verification and deploy

**Files:** none (verification only)

- [ ] **Step 1: Confirm the migration was applied**

Query the real Supabase project (Table Editor or SQL Editor) to confirm `public.quiz_attempts` exists with the expected columns and RLS enabled. If Task 1 Step 5 wasn't done yet, do it now — nothing past this point works without the table.

- [ ] **Step 2: Full project typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors across the whole project (not just the new files).

- [ ] **Step 3: Start the dev server and manually exercise the flow**

Run: `npm run dev`
Then, as a logged-in test student in a real browser (mic access requires a real browser, not curl):
1. Go to `/student/quiz`. Confirm "Speaking Quiz" and "Translator" panels render side by side (stacked on a narrow window).
2. Click "New Prompt" — confirm a plausible English instruction appears within a few seconds.
3. Click "Record", speak a sentence, click "Stop" — confirm playback controls appear and the recording plays back correctly.
4. Click "Submit for Grading" — confirm a result card appears with an overall score, three sub-scores, a transcript, strengths, improvements, and feedback, and that it roughly matches what was actually said.
5. Confirm the "Recent Attempts" list now shows this attempt.
6. Refresh the page — confirm the attempt is still there (proves it persisted to `quiz_attempts`, not just local state).
7. In the Translator panel, type an English word (e.g. "goodbye") and click "Translate" — confirm a French translation and example sentence appear.
8. Deny microphone access once (browser permission prompt) and confirm the quiz shows a friendly error instead of crashing.

If any step fails, fix the underlying code and re-run from Step 2 — do not proceed to deploy with a known-broken flow.

- [ ] **Step 4: Verify RLS isolation**

Using two different test student accounts (or one student account plus the admin dashboard), confirm: a student can see their own `quiz_attempts` rows and cannot see another student's; the admin can see all of them (e.g. via a quick `select * from quiz_attempts` in the Supabase SQL Editor while impersonating context, or simply confirming the `quiz_attempts_admin_select`/`quiz_attempts_self_select` policies exist as expected from Task 1).

- [ ] **Step 5: Deploy**

Follow the same stash-deploy-restore pattern used for prior features in this session (this repo currently has unrelated uncommitted work in progress that should not ship in this deploy):

```bash
git status --porcelain   # confirm what's uncommitted right now
git stash push -u -m "wip: unrelated in-progress work (not for this deploy)"
vercel --prod --yes
git stash pop
```

- [ ] **Step 6: Post-deploy smoke check**

Repeat Step 3's manual flow once against the live production URL to confirm it works there too (Gemini quota, RLS, and Vercel Function behavior can all differ from local dev).
