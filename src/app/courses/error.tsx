"use client";

import { useEffect } from "react";

export default function CoursesError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[Courses] Unexpected render error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-display text-lg font-semibold text-navy">
        Course information is temporarily unavailable.
      </p>
      <p className="mt-2 text-sm text-navy/60">Please try again shortly.</p>
    </div>
  );
}
