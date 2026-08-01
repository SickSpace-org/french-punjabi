import { Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";

export const revalidate = 0;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

export default async function StudentProfilePage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Profile</h1>
      <p className="mt-1 text-sm text-navy/60">
        Need something updated? Contact the AngrishFrançais team.
      </p>

      <div className="mt-8 max-w-lg rounded-2xl border border-navy/10 bg-white p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Full Name" value={student.full_name} />
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
          <Field
            label="Account Status"
            value={
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                {student.status}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
