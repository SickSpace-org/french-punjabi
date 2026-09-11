import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// A fixed prompt asked repeatedly tends to make the model converge on the
// same handful of passages. Picking a random topic per call — plus a higher
// temperature — forces real variety instead of relying on the model to
// "just be creative" with an identical prompt every time.
const TOPICS = [
  "a normal weekday morning routine",
  "a family dinner or gathering",
  "a trip to the market or supermarket",
  "planning a weekend trip",
  "a visit to the doctor",
  "meeting a friend at a cafe",
  "a day at work or school",
  "cooking a favorite meal",
  "the weather and how it affects someone's plans",
  "a hobby or sport someone enjoys",
  "moving to a new city or apartment",
  "celebrating a birthday or holiday",
  "taking public transportation",
  "a phone call with a family member",
  "shopping for clothes",
];

function pickTopic(): string {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

export async function generateReadingPassage(): Promise<string> {
  const topic = pickTopic();
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt: `You write short French reading-aloud passages for a language learner preparing for the TEF/TCF Canada exam. Generate ONE fresh passage, written entirely in French, 2-4 sentences long, about: ${topic}. Invent different names and details each time so it never repeats a previous passage. A beginner-to-intermediate student should be able to read it aloud in about 20-40 seconds — use everyday vocabulary and simple sentence structures (present, passé composé, or imparfait). Return ONLY the French passage itself, nothing else — no English translation, no quotes, no preamble.`,
    temperature: 1.1,
  });
  return text.trim();
}
