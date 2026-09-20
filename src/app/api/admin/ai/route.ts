import "server-only";
import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_AI_SYSTEM_PROMPT } from "@/lib/adminAi/systemPrompt";
import { buildAdminAiTools } from "@/lib/adminAi/tools";

/**
 * Not covered by proxy.ts (its matcher only guards /admin/:path* and
 * /student/:path*, not /api/:path*) — same reasoning as
 * /api/admin/video-upload/_shared.ts's requireAdmin, duplicated inline here
 * since this route also needs the session-carrying `supabase` client itself
 * (passed into the tools) rather than just a yes/no admin check.
 */
async function requireAdminSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
  if (!adminRow) return null;

  return supabase;
}

export async function POST(req: Request) {
  const supabase = await requireAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-flash-lite-latest"),
    system: ADMIN_AI_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: buildAdminAiTools(supabase),
    stopWhen: stepCountIs(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
