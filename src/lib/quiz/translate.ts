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
