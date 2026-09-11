import "server-only";
import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/systemPrompt";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-3.6-flash"),
    system: CHAT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      google: {
        // A chat-widget doubt-answerer doesn't need deep multi-step
        // reasoning — minimal thinking cuts time-to-first-token a lot.
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
