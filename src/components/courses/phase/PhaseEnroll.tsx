"use client";

import { Suspense, useState } from "react";
import type { Phase } from "@/lib/courses/types";
import PhasePanel from "../PhasePanel";
import CourseDeepLink from "../CourseDeepLink";
import EnrollModal, { type EnrollSelection } from "../EnrollModal";
import WaitlistModal, { type WaitlistSelection } from "../WaitlistModal";

export default function PhaseEnroll({ phase }: { phase: Phase }) {
  const [selection, setSelection] = useState<EnrollSelection | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistSelection | null>(null);

  return (
    <>
      <Suspense fallback={null}>
        <CourseDeepLink phase={phase} />
      </Suspense>
      <PhasePanel phase={phase} onEnroll={setSelection} onWaitlist={setWaitlist} />
      <EnrollModal selection={selection} onClose={() => setSelection(null)} />
      <WaitlistModal selection={waitlist} onClose={() => setWaitlist(null)} />
    </>
  );
}
