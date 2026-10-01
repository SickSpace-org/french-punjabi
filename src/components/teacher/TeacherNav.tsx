"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "Attendance", href: "/teacher/attendance", icon: CalendarCheck },
];

export default function TeacherNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-navy/10 bg-white px-4 sm:px-8">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
              active ? "border-red text-red-dark" : "border-transparent text-navy/60 hover:text-navy"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
