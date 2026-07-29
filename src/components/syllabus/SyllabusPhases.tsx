import { PHASE_1_LEVELS, PHASE_2_LEVELS, PHASE_META } from "@/data/syllabus";
import SyllabusPhaseNav from "./SyllabusPhaseNav";
import PhaseCurriculum from "./PhaseCurriculum";
import Phase3Practice from "./Phase3Practice";

export default function SyllabusPhases() {
  return (
    <>
      <SyllabusPhaseNav />

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <PhaseCurriculum meta={PHASE_META[0]} levels={PHASE_1_LEVELS} tone="navy" />
        </div>
      </section>

      <section className="bg-red-soft/25 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <PhaseCurriculum meta={PHASE_META[1]} levels={PHASE_2_LEVELS} tone="red" />
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <Phase3Practice />
        </div>
      </section>
    </>
  );
}
