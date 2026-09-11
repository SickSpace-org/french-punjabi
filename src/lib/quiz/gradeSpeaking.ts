import "server-only";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { quizGradeSchema, type QuizGrade } from "./schema";

export type QuizMode = "free" | "read-aloud";

const SHARED_RUBRIC = `You are a French pronunciation and speaking examiner grading a language learner's practice recording for TEF/TCF Canada exam preparation — NOT a native speaker, so grade with that in mind. You will hear an audio recording.

Score pronunciation (accent accuracy, individual sound production), fluency (pace, hesitation, flow), and grammar (verb conjugation, agreement, sentence structure), each 0-100, then an overall score 0-100. List 2-4 specific strengths. List 2-4 specific, actionable improvements — name the exact sound, word, or grammar point to fix, not generic advice like "practice more." Write a short, encouraging 2-3 sentence feedback summary.

If the recording is silent, inaudible, or not French speech, say so plainly in the transcript and score accordingly (low scores, feedback explaining why).`;

function buildInstructions(mode: QuizMode, promptOrText: string): string {
  if (mode === "read-aloud") {
    return `${SHARED_RUBRIC}

The student was given this exact French text to read aloud:
"""
${promptOrText}
"""

Transcribe exactly what the student actually said, in French. Compare it word-for-word against the target text above: note any words skipped, substituted, or mispronounced, and factor reading fidelity (did they read the actual text, not just speak French generally) into the pronunciation and fluency scores. The transcript field should reflect what they actually said, not the target text.`;
  }

  return `${SHARED_RUBRIC}

Transcribe exactly what the student said, in French. The student was asked to: "${promptOrText}"`;
}

export async function gradeSpeaking(mode: QuizMode, promptOrText: string, wavBase64: string): Promise<QuizGrade> {
  const { object } = await generateObject({
    model: google("gemini-flash-lite-latest"),
    schema: quizGradeSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildInstructions(mode, promptOrText) },
          { type: "file", mediaType: "audio/wav", data: wavBase64 },
        ],
      },
    ],
  });

  return object;
}
