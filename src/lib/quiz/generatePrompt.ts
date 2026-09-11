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
