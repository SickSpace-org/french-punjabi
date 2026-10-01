import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherDetail } from "@/lib/teachers/getTeacherDetail";
import TeacherDetailClient from "@/components/admin/teachers/TeacherDetailClient";

export const revalidate = 0;

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  const supabase = await createClient();
  const teacher = await getTeacherDetail(supabase, teacherId);

  if (!teacher) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">{teacher.full_name}</h1>
      <p className="mt-1 text-sm text-navy/60">{teacher.email}</p>

      <div className="mt-6">
        <TeacherDetailClient initialTeacher={teacher} />
      </div>
    </div>
  );
}
