import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAdminComments } from "@/lib/comments/getAdminComments";
import { replyToComment as replyToCommentAction } from "@/app/admin/(dashboard)/comments/actions";

/** Student lesson Q&A tools — everything under the admin Comments inbox. */
export function buildCommentTools(supabase: SupabaseClient<Database>) {
  return {
    listStudentQuestions: tool({
      description: "List student questions on lesson videos, most recent first. Each includes whether it's already been replied to.",
      inputSchema: z.object({ onlyUnanswered: z.boolean().default(false) }),
      execute: async ({ onlyUnanswered }) => {
        const comments = await getAdminComments(supabase);
        const filtered = onlyUnanswered ? comments.filter((c) => c.replies.length === 0) : comments;
        return {
          questions: filtered.slice(0, 20).map((c) => ({
            questionId: c.id,
            studentName: c.studentName,
            body: c.body,
            lessonTitle: c.lessonTitle,
            courseTitle: c.courseTitle,
            answered: c.replies.length > 0,
          })),
        };
      },
    }),

    replyToStudentQuestion: tool({
      description: "Post a reply to a student's lesson question — they'll be notified in their portal. Call listStudentQuestions first to get the questionId.",
      inputSchema: z.object({ questionId: z.string(), body: z.string() }),
      execute: async ({ questionId, body }) => replyToCommentAction(questionId, body),
    }),
  };
}
