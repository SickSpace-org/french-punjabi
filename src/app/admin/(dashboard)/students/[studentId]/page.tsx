import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAssignableCourses, getStudentDetail } from "@/lib/students/getStudentDetail";
import StudentDetailClient from "@/components/admin/students/StudentDetailClient";

export const revalidate = 0;

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();

  const student = await getStudentDetail(supabase, studentId);
  if (!student) notFound();

  const assignableCourses = await getAssignableCourses(supabase);

  return (
    <div>
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-red-dark"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to Students
      </Link>

      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-navy">{student.full_name}</h1>
      </div>

      <div className="mt-8">
        <StudentDetailClient initialStudent={student} assignableCourses={assignableCourses} />
      </div>
    </div>
  );
}
