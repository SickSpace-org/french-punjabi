"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, LayoutDashboard, Menu, Users, X } from "lucide-react";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Courses", href: "/admin/courses", icon: BookOpenCheck },
  { label: "Enrollments", href: "/admin/enrollments", icon: Users },
  { label: "Students", href: "/admin/students", icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream-dim">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-navy/10 bg-white lg:flex">
        <div className="px-6 py-6">
          <p className="font-display text-lg font-semibold tracking-tight text-navy">
            French<span className="text-red">Punjabi</span>
          </p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-navy/40">
            Admin
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-red-soft text-red-dark" : "text-navy/70 hover:bg-cream-dim"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-navy/10 p-4">
          <p className="truncate px-1 text-xs text-navy/45">{email}</p>
          <LogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
        <p className="font-display text-base font-semibold tracking-tight text-navy">
          French<span className="text-red">Punjabi</span>{" "}
          <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">Admin</span>
        </p>
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-navy hover:bg-cream-dim"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <div className="border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-red-soft text-red-dark" : "text-navy/70 hover:bg-cream-dim"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 space-y-2 border-t border-navy/10 pt-3">
            <p className="truncate px-1 text-xs text-navy/45">{email}</p>
            <LogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
