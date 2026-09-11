const CALENDLY_URL = "https://calendly.com/hiteshsharma2454/19-june-mock-test";

export default function TestSlotView() {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-navy">Test</p>
      <p className="mt-1 text-sm text-navy/60">
        Your weekly mock test is every Friday, 15 minutes — book your slot below.
      </p>

      <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy">Friday 15-Minute Test</p>
            <p className="mt-1 text-xs text-navy/50">Pick an available time that works for you.</p>
          </div>

          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md"
          >
            Book Your Test
          </a>
        </div>
      </div>
    </div>
  );
}
