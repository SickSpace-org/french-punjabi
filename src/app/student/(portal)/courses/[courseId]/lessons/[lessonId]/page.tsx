import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentLessonDetail } from "@/lib/student/getLessonDetail";
import { getLessonComments } from "@/lib/student/getComments";
import VideoPlayer from "@/components/student/VideoPlayer";
import MarkCompleteButton from "@/components/student/MarkCompleteButton";
import LessonResourceLink from "@/components/student/LessonResourceLink";
import CommentThread from "@/components/student/CommentThread";

export const revalidate = 0;

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) notFound();

  // Deny access if the student lacks active course access, the lesson
  // isn't published, or it doesn't belong to this course — RLS backs this
  // up independently regardless of what the URL says.
  const lesson = await getStudentLessonDetail(supabase, student.id, courseId, lessonId);
  if (!lesson) notFound();

  const comments = await getLessonComments(supabase, lessonId, student.id);

  return (
    <div>
      <Link
        href={`/student/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-red-dark"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to {lesson.courseTitle}
      </Link>

      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-red">
          {lesson.phaseTitle}
          {lesson.levelName ? ` — ${lesson.levelName}` : ""}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
          Week {lesson.weekNumber} • {lesson.weekTitle}
        </p>
        <h1 className="font-display text-2xl font-bold text-navy">{lesson.title}</h1>
        {lesson.description ? <p className="mt-1 text-sm text-navy/60">{lesson.description}</p> : null}
      </div>

      <div className="mt-6">
        <VideoPlayer videoUrl={lesson.videoUrl} />
      </div>

      {lesson.notes ? (
        <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Lesson Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy/80">{lesson.notes}</p>
        </div>
      ) : null}

      {lesson.resources.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Resources</p>
          <div className="mt-2 space-y-2">
            {lesson.resources.map((resource) => (
              <LessonResourceLink key={resource.id} resourceId={resource.id} title={resource.title} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-navy/10 py-5">
        {lesson.prevLessonId ? (
          <Link
            href={`/student/courses/${courseId}/lessons/${lesson.prevLessonId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Previous Lesson
          </Link>
        ) : (
          <span />
        )}

        <MarkCompleteButton lessonId={lesson.id} initialCompleted={lesson.completed} />

        {lesson.nextLessonId ? (
          <Link
            href={`/student/courses/${courseId}/lessons/${lesson.nextLessonId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
          >
            Next Lesson
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="mt-8">
        <CommentThread lessonId={lesson.id} initialComments={comments} />
      </div>
    </div>
  );
}
