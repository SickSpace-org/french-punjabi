import { createClient } from "@/lib/supabase/server";
import { getAdminComments } from "@/lib/comments/getAdminComments";
import CommentsInboxClient from "@/components/admin/comments/CommentsInboxClient";

export const revalidate = 0;

export default async function AdminCommentsPage() {
  const supabase = await createClient();

  let comments: Awaited<ReturnType<typeof getAdminComments>> | null = null;
  try {
    comments = await getAdminComments(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load comments:", error);
  }

  if (!comments) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Comments</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load student questions right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Comments</h1>
      <p className="mt-1 text-sm text-navy/60">
        Student questions across every lesson — reply here without opening each one individually.
      </p>

      <div className="mt-8">
        <CommentsInboxClient initialComments={comments} />
      </div>
    </div>
  );
}
