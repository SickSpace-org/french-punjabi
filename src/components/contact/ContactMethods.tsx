import { Mail, MessageCircle } from "lucide-react";
import Reveal from "@/components/Reveal";
import { InstagramIcon } from "@/components/icons/SocialIcons";
import { CONTACT_INFO } from "@/data/contact";

const METHODS = [
  {
    id: "whatsapp",
    icon: MessageCircle,
    title: "WhatsApp",
    value: CONTACT_INFO.whatsappDisplay,
    caption: "Message us directly — fastest way to reach us.",
    href: CONTACT_INFO.whatsappHref,
    cta: "Message on WhatsApp",
  },
  {
    id: "instagram",
    icon: InstagramIcon,
    title: "Instagram",
    value: CONTACT_INFO.instagramHandle,
    caption: "You can DM anytime.",
    href: CONTACT_INFO.instagramHref,
    cta: "Open Instagram",
  },
  {
    id: "email",
    icon: Mail,
    title: "Email",
    value: CONTACT_INFO.email,
    caption: "For detailed questions or documents.",
    href: `mailto:${CONTACT_INFO.email}`,
    cta: "Send an Email",
  },
];

export default function ContactMethods() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {METHODS.map((method, index) => (
            <Reveal key={method.id} variant="scale" delayMs={index * 90}>
              <a
                href={method.href}
                target="_blank"
                rel="noopener noreferrer"
                className="laminate group flex h-full flex-col items-center rounded-2xl border border-navy/10 p-8 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-red/25"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-soft text-red transition-transform duration-300 group-hover:scale-110">
                  <method.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold text-navy">{method.title}</h3>
                <p className="mt-1 break-words text-sm font-semibold text-red-dark">
                  {method.value}
                </p>
                <p className="mt-2 text-sm text-navy/60">{method.caption}</p>
                <span className="mt-6 inline-flex items-center justify-center rounded-full bg-red px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 group-hover:bg-red-dark group-hover:shadow-md">
                  {method.cta}
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
