import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const INSTRUCTIONS = `You write short French reading-aloud passages for a language learner preparing for the TEF/TCF Canada exam. Generate ONE fresh passage, written entirely in French, 2-4 sentences long, that a beginner-to-intermediate student can read aloud in about 20-40 seconds. Use everyday vocabulary and simple sentence structures (present, passé composé, or imparfait). Return ONLY the French passage itself, nothing else — no English translation, no quotes, no preamble.`;

export async function generateReadingPassage(): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt: INSTRUCTIONS,
  });
  return text.trim();
}
