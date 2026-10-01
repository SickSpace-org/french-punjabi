import { CalendarClock, CheckCheck, MessageCircle } from "lucide-react";
import { CONTACT_INFO } from "@/data/contact";
import BookCallButton from "@/components/BookCallButton";

/** Illustrative chat bubbles in the hero; they pop in one after another. */
const CHAT = [
  { from: "you", text: "Bonjour! I want French for my PR. Where should I start?" },
  { from: "us", text: "Great goal! Tell us what you know so far and we'll find your level." },
  { from: "you", text: "Complete beginner, and I work 9 to 5." },
  { from: "us", text: "Phase 1 in an evening batch fits you. Want to book a quick call?" },
];

export default function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="hero-blob pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-red/35 blur-3xl" />
      <div className="hero-blob pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-blue/30 blur-3xl [animation-delay:-8s]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-24 lg:pt-20">
        <div>
          <p className="program-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/75">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Get in touch
          </p>
          <h1 className="program-rise mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight [animation-delay:80ms] sm:text-6xl">
            Talk to a real person,
            <br />
            <span className="italic text-blue-soft/90">not a form.</span>
          </h1>
          <p className="program-rise mt-6 max-w-lg text-lg leading-relaxed text-white/70 [animation-delay:160ms]">
            Not sure which phase or batch is right for you? Message us or book a call. We&apos;ll
            help you find your level and the timing that fits your day.
          </p>

          <div className="program-rise mt-9 flex flex-wrap gap-3 [animation-delay:240ms]">
            <a
              href={CONTACT_INFO.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </a>
            <BookCallButton
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:bg-cream-dim"
            >
              <CalendarClock className="h-4 w-4 text-red" />
              Book a consultation
            </BookCallButton>
          </div>
        </div>

        {/* Chat mockup */}
        <div className="program-rise mx-auto w-full max-w-sm [animation-delay:200ms]" aria-hidden="true">
          <div className="overflow-hidden rounded-[2rem] bg-cream shadow-2xl shadow-black/40 ring-8 ring-white/10">
            <div className="flex items-center gap-3 bg-navy-light px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red font-display text-sm font-bold">
                AF
              </span>
              <div>
                <p className="text-sm font-semibold">AngrishFrançais</p>
                <p className="text-xs text-emerald-300">online</p>
              </div>
            </div>
            <div className="bg-dot-grid space-y-3 px-4 py-5">
              {CHAT.map((m, i) => (
                <div
                  key={i}
                  className={`chat-pop flex ${m.from === "you" ? "justify-end" : "justify-start"}`}
                  style={{ animationDelay: `${700 + i * 900}ms` }}
                >
                  <p
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-snug shadow-sm ${
                      m.from === "you"
                        ? "rounded-br-md bg-red text-white"
                        : "rounded-bl-md bg-white text-navy"
                    }`}
                  >
                    {m.text}
                    {m.from === "you" ? (
                      <CheckCheck className="ml-1.5 inline h-3.5 w-3.5 text-white/70" />
                    ) : null}
                  </p>
                </div>
              ))}
              <div className="chat-pop flex justify-start" style={{ animationDelay: `${700 + CHAT.length * 900}ms` }}>
                <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy/40"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
