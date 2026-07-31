"use client";

import type { AdminPhase } from "@/lib/courses/getAdminCourseData";
import type { ProgramOfferRow } from "@/types/database";
import PhaseCard from "@/components/admin/courses/PhaseCard";
import ProgramOffersSection from "@/components/admin/courses/ProgramOffersSection";

export default function CoursesAdminClient({
  initialPhases,
  initialProgramOffers,
}: {
  initialPhases: AdminPhase[];
  initialProgramOffers: ProgramOfferRow[];
}) {
  // Server Actions in ./actions.ts call revalidatePath('/admin/courses'),
  // so this page's Server Component parent automatically re-fetches and
  // passes fresh props after every save — no local state mirroring needed.
  const phases = initialPhases;
  const programOffers = initialProgramOffers;

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <PhaseCard key={phase.id} phase={phase} />
      ))}

      <ProgramOffersSection offers={programOffers} />
    </div>
  );
}
