"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  Copy,
  Mail,
  MessageCircle,
  PhoneCall,
  Route,
  ShieldCheck,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import { InstagramIcon, YoutubeIcon } from "@/components/icons/SocialIcons";
import { CONTACT_INFO } from "@/data/contact";
import BookCallButton from "@/components/BookCallButton";

const METHODS = [
  {
    id: "whatsapp",
    icon: MessageCircle,
    need: "Quick question?",
    title: "WhatsApp",
    value: CONTACT_INFO.whatsappDisplay,
    caption: "The fastest way to reach us.",
    href: CONTACT_INFO.whatsappHref,
    cta: "Message us",
    tile: "bg-[#25D366]/12 text-[#128C7E] group-hover:bg-[#25D366] group-hover:text-white",
  },
  {
    id: "instagram",
    icon: InstagramIcon,
    need: "Prefer to DM?",
    title: "Instagram",
    value: CONTACT_INFO.instagramHandle,
    caption: "DM us anytime.",
    href: CONTACT_INFO.instagramHref,
    cta: "Open Instagram",
    tile: "bg-pink-50 text-pink-600 group-hover:bg-gradient-to-br group-hover:from-amber-400 group-hover:via-pink-500 group-hover:to-purple-600 group-hover:text-white",
  },
  {
    id: "email",
    icon: Mail,
    need: "Sending documents?",
    title: "Email",
    value: CONTACT_INFO.email,
    caption: "Best for detailed questions or files.",
    href: `mailto:${CONTACT_INFO.email}`,
    cta: "Send an email",
    tile: "bg-red-soft text-red group-hover:bg-red group-hover:text-white",
  },
];

const NEXT_STEPS = [
  { icon: PhoneCall, title: "You reach out", body: "Message us or book a call at a time that suits you." },
  { icon: Route, title: "We find your level", body: "We talk through your goal, what you know and your schedule." },
  { icon: CalendarClock, title: "You get a clear plan", body: "The right phase, the right batch timing, and the dates." },
  { icon: ShieldCheck, title: "Try it risk-free", body: "Attend for 7 days. Not for you? Full refund, per the program terms." },
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked; the value is still visible to copy by hand */
        }
      }}
      aria-label={`Copy ${label}`}
      className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy/40 transition-colors hover:bg-cream hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

export default function ContactMethods() {
  return (
    <>
      <section className="bg-cream py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Pick what&apos;s easiest</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              However you like to talk, we&apos;re there.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
            {/* Recommended: consultation */}
            <Reveal variant="scale" className="h-full">
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-navy p-8 text-white shadow-2xl shadow-navy/20 sm:p-10">
                <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red/40 blur-3xl transition-transform duration-700 group-hover:scale-125" />
                <div className="relative flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <CalendarClock className="h-6 w-6" />
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">
                    Recommended
                  </span>
                </div>
                <p className="relative mt-8 text-sm font-semibold text-blue-soft/80">Not sure where to start?</p>
                <h3 className="relative mt-1 font-display text-3xl font-semibold">Book a consultation call</h3>
                <p className="relative mt-3 max-w-md leading-relaxed text-white/70">
                  Pick a time that suits you and we&apos;ll call you. Talk through your goal,
                  where to start and which batch fits your schedule.
                </p>
                <ul className="relative mt-6 space-y-2.5 text-sm text-white/85">
                  {["Find your current level", "Get the right phase and batch", "Ask anything about TEF or TCF"].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-auto pt-8">
                  <BookCallButton
                    className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-navy shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cream-dim"
                  >
                    Choose a time
                    <ArrowUpRight className="h-4 w-4" />
                  </BookCallButton>
                </div>
              </div>
            </Reveal>

            {/* Other channels */}
            <div className="flex flex-col gap-4">
              {METHODS.map((m, i) => (
                <Reveal key={m.id} variant="right" delayMs={100 + i * 110}>
                  <div className="group relative flex items-center gap-5 rounded-3xl border border-navy/10 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-xl hover:shadow-navy/10 sm:p-6">
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${m.cta}: ${m.value}`}
                      className="absolute inset-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                    />
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-105 ${m.tile}`}
                    >
                      <m.icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">{m.need}</p>
                      <p className="font-display text-lg font-semibold text-navy">{m.title}</p>
                      <p className="truncate text-sm font-semibold text-red-dark">{m.value}</p>
                      <p className="text-sm text-navy/55">{m.caption}</p>
                    </div>
                    {m.id !== "instagram" ? <CopyButton value={m.value} label={m.title} /> : null}
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-navy/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red" />
                  </div>
                </Reveal>
              ))}

              <Reveal variant="right" delayMs={450}>
                <a
                  href={CONTACT_INFO.youtubeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl px-2 py-1 text-sm text-navy/60 transition-colors hover:text-navy"
                >
                  <YoutubeIcon className="h-5 w-5 text-red-600" />
                  Watch us on YouTube
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">What happens next</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              From first message to first class.
            </h2>
          </Reveal>

          <Reveal variant="fade" className="journey mt-14">
            <div className="relative mb-8 hidden h-1.5 rounded-full bg-navy/8 lg:block">
              <div className="journey-line absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-navy via-red to-blue" />
            </div>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {NEXT_STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <Reveal variant="up" delayMs={200 + i * 150} className="h-full">
                    <div className="group h-full rounded-3xl bg-cream p-6 ring-1 ring-navy/8 transition-all duration-500 hover:-translate-y-1.5 hover:bg-white hover:shadow-xl hover:shadow-navy/10">
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white transition-all duration-500 group-hover:rotate-[-6deg] group-hover:bg-red">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-display text-4xl font-bold text-navy/10">0{i + 1}</span>
                      </div>
                      <h3 className="mt-5 font-display text-xl font-semibold text-navy">{title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-navy/65">{body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>
    </>
  );
}
