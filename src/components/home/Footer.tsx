import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
} from "@/components/icons/SocialIcons";
import Reveal from "@/components/Reveal";
import { CONTACT_INFO } from "@/data/contact";

const QUICK_LINKS = [
  { label: "Home", href: "/#home" },
  { label: "Structure", href: "/structure" },
  { label: "Courses", href: "/courses" },
  { label: "Syllabus", href: "/syllabus" },
  { label: "Results", href: "/results" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Contact", href: "/contact" },
];

const CONTACT_ITEMS = [
  { icon: MessageCircle, label: CONTACT_INFO.whatsappDisplay, href: CONTACT_INFO.whatsappHref },
  { icon: Mail, label: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
];

const SOCIALS = [
  { icon: InstagramIcon, label: "Instagram", href: CONTACT_INFO.instagramHref },
  { icon: YoutubeIcon, label: "YouTube", href: "#" },
  { icon: FacebookIcon, label: "Facebook", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-t border-navy/10 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <Reveal className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-xl font-semibold tracking-tight text-navy">
              French<span className="text-red">Punjabi</span>
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy/60">
              Structured French learning and TEF/TCF preparation.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/40">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-navy/70 transition-colors hover:text-red"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/40">
              Contact
            </h3>
            <ul className="mt-4 space-y-3">
              {CONTACT_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue transition-colors group-hover:bg-red-soft group-hover:text-red">
                      <item.icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="text-sm text-navy/60 transition-colors group-hover:text-red-dark">
                      {item.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/40">
              Follow Us
            </h3>
            <div className="mt-4 flex items-center gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 text-navy/50 transition-all duration-300 hover:-translate-y-0.5 hover:border-red/30 hover:text-red hover:shadow-sm"
                >
                  <social.icon className="h-4.5 w-4.5" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-14 border-t border-navy/10 pt-8 text-center">
          <p className="text-xs text-navy/40">
            © AngrishFrançais. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
