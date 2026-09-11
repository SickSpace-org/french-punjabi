const CALENDLY_URL = "https://calendly.com/hiteshsharma2454/19-june-mock-test";

/**
 * Dashboard prompt for the weekly Friday 15-minute mock test. Every student
 * books the same shared Calendly link themselves — there's no per-student
 * admin-assigned time/meeting link for this anymore.
 */
export default function TestSlotCard() {
  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Friday Test</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-navy">15-minute mock test, every Friday</p>

        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md"
        >
          Book Your Slot
        </a>
      </div>
    </div>
  );
}
