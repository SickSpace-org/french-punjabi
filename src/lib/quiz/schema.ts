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
