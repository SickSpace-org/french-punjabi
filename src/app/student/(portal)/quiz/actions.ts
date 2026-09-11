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
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

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
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Type a word or phrase first." };

  try {
    const translation = await translateWord(trimmed);
    return { ok: true, translation };
  } catch {
    return { ok: false, error: "Translation failed. Please try again." };
  }
}
