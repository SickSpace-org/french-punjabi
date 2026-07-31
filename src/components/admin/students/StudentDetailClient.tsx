"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import type { StudentDetail, AssignableCourse } from "@/lib/students/getStudentDetail";
import {
  reactivateStudent,
  restoreCourseAccess,
  revokeCourseAccess,
  suspendStudent,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import AssignCourseModal from "./AssignCourseModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

export default function StudentDetailClient({
  initialStudent,
  assignableCourses,
}: {
  initialStudent: StudentDetail;
  assignableCourses: AssignableCourse[];
}) {
  const { showToast } = useToast();
  const [student, setStudent] = useState(initialStudent);
  const [pending, startTransition] = useTransition();
  const [assigning, setAssigning] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<StudentDetail["access"][number] | null>(null);

  const assignedCourseIds = new Set(
    student.access.filter((a) => a.status === "ACTIVE").map((a) => a.courseId)
  );
  const availableToAssign = assignableCourses.filter((c) => !assignedCourseIds.has(c.id));

  const handleSuspendToggle = () => {
    if (student.status === "ACTIVE") {
      setConfirmSuspend(true);
      return;
    }
    startTransition(async () => {
      const result = await reactivateStudent(student.id);
      if (result.ok) {
        setStudent((prev) => ({ ...prev, status: "ACTIVE" }));
        showToast("Student reactivated — access restored.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const confirmSuspendNow = () => {
    startTransition(async () => {
      const result = await suspendStudent(student.id);
      setConfirmSuspend(false);
      if (result.ok) {
        setStudent((prev) => ({ ...prev, status: "SUSPENDED" }));
        showToast("Student suspended — all course access is now blocked.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const handleRevoke = () => {
    if (!confirmRevoke) return;
    const access = confirmRevoke;
    startTransition(async () => {
      const result = await revokeCourseAccess(access.id, student.id);
      setConfirmRevoke(null);
      if (result.ok) {
        setStudent((prev) => ({
          ...prev,
          access: prev.access.map((a) => (a.id === access.id ? { ...a, status: "REVOKED" } : a)),
        }));
        showToast("Course access revoked.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const handleRestore = (access: StudentDetail["access"][number]) => {
    startTransition(async () => {
      const result = await restoreCourseAccess(access.id, student.id);
      if (result.ok) {
        setStudent((prev) => ({
          ...prev,
          access: prev.access.map((a) => (a.id === access.id ? { ...a, status: "ACTIVE" } : a)),
        }));
        showToast("Course access restored.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                  {student.email}
                </span>
              }
            />
            <Field
              label="Phone"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                  {student.phone}
                </span>
              }
            />
            <Field label="Country" value={student.country} />
            <Field label="Enrollment Reference" value={student.enrollment_ref} />
            <Field label="Enrolled" value={formatDate(student.enrolled_at)} />
            <Field
              label="Portal Login"
              value={student.auth_user_id ? "Invited / active" : "Not yet invited"}
            />
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                STATUS_STYLES[student.status] ?? STATUS_STYLES.INACTIVE
              }`}
            >
              {student.status}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={handleSuspendToggle}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60 ${
                student.status === "ACTIVE"
                  ? "border-red/20 bg-white text-red hover:bg-red-soft"
                  : "border-navy/15 bg-white text-navy hover:bg-cream-dim"
              }`}
            >
              {student.status === "ACTIVE" ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  Suspend Student
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Reactivate Student
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Course Access</p>
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Assign Course
          </button>
        </div>

        {student.access.length === 0 ? (
          <p className="mt-4 text-sm text-navy/50">No courses assigned yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {student.access.map((access) => (
              <div
                key={access.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy/10 bg-cream-dim/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {access.phaseTitle}
                    {access.levelName ? ` — ${access.levelName}` : ""}
                  </p>
                  <p className="text-xs text-navy/50">{access.courseTitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      access.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-navy/10 text-navy/50"
                    }`}
                  >
                    {access.status}
                  </span>
                  {access.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmRevoke(access)}
                      className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-red/30 hover:text-red disabled:opacity-60"
                    >
                      Revoke Access
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRestore(access)}
                      className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assigning ? (
        <AssignCourseModal
          studentId={student.id}
          courses={availableToAssign}
          onClose={() => setAssigning(false)}
          onAssigned={(course) => {
            setStudent((prev) => {
              const existing = prev.access.find((a) => a.courseId === course.id);
              if (existing) {
                return {
                  ...prev,
                  access: prev.access.map((a) =>
                    a.courseId === course.id ? { ...a, status: "ACTIVE", revoked_at: null } : a
                  ),
                };
              }
              return {
                ...prev,
                access: [
                  ...prev.access,
                  {
                    id: `${course.id}-pending`,
                    status: "ACTIVE",
                    granted_at: new Date().toISOString(),
                    revoked_at: null,
                    courseId: course.id,
                    courseTitle: course.title,
                    phaseTitle: course.phaseTitle,
                    levelName: course.levelName,
                  },
                ],
              };
            });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend this student?"
        description="They immediately lose access to ALL course content. Progress, comments, enrollment and course assignments are kept — reactivating restores access."
        confirmLabel="Suspend Student"
        danger
        pending={pending}
        onCancel={() => setConfirmSuspend(false)}
        onConfirm={confirmSuspendNow}
      />

      <ConfirmDialog
        open={confirmRevoke != null}
        title="Revoke this course?"
        description="The student immediately loses access to this course only — their account and other courses are unaffected. You can restore it later."
        confirmLabel="Revoke Access"
        danger
        pending={pending}
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
