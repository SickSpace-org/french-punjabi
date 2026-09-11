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
