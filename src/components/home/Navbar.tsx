"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "/#home" },
  { label: "Structure", href: "/structure" },
  { label: "Courses", href: "/courses" },
  { label: "Syllabus", href: "/syllabus" },
  { label: "Team", href: "/team" },
  { label: "Results", href: "/results" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-navy/8 bg-cream/90 shadow-[0_2px_16px_-4px_rgba(11,28,57,0.12)] backdrop-blur-md"
          : "border-b border-transparent bg-cream/60 backdrop-blur-sm"
      }`}
    >
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-[padding] duration-300 lg:px-10 ${
          isScrolled ? "py-3" : "py-4 lg:py-5"
        }`}
      >
        <Link href="/#home" className="flex items-center gap-2 shrink-0">
          <span className="font-display text-xl font-semibold tracking-tight text-navy">
            French<span className="text-red">Punjabi</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={`${link.label}-${link.href}`}>
              <Link
                href={link.href}
                className="relative text-sm font-medium text-navy/75 transition-colors hover:text-navy after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-0 after:bg-red after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/student/login"
            className="text-sm font-medium text-navy/60 transition-colors hover:text-navy"
          >
            Student Login
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center justify-center rounded-full bg-red px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red/30 transition-all duration-300 hover:bg-red-dark hover:shadow-md hover:shadow-red/40"
          >
            Join a Batch
          </Link>
        </div>

        <button
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-full p-2 text-navy transition-colors hover:bg-navy/5 lg:hidden"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <div
        className={`grid overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <ul className="flex flex-col gap-1 border-t border-navy/10 bg-cream px-6 py-4">
            {NAV_LINKS.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-navy/80 transition-colors hover:bg-navy/5 hover:text-navy"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="px-3 pt-1">
              <Link
                href="/student/login"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg px-0 py-2 text-sm font-medium text-navy/60 hover:text-navy"
              >
                Student Login
              </Link>
            </li>
            <li className="mt-1 px-3">
              <Link
                href="/courses"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center justify-center rounded-full bg-red px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-red/30 transition-colors hover:bg-red-dark"
              >
                Join a Batch
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
