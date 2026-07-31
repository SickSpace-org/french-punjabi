import Link from "next/link";
import { BookOpenCheck, GraduationCap, Users } from "lucide-react";

const CARDS = [
  {
    title: "Courses",
    description: "Manage phases, levels, batches, timings and pricing",
    href: "/admin/courses",
    icon: BookOpenCheck,
  },
  {
    title: "Enrollments",
    description: "Review and manage student enrollment applications",
    href: "/admin/enrollments",
    icon: Users,
  },
  {
    title: "Students",
    description: "Reserved for future student management",
    href: "/admin/students",
    icon: GraduationCap,
  },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-navy/60">Welcome back.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-navy/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red/25 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-soft text-red">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="mt-4 font-display text-base font-bold text-navy">{card.title}</p>
              <p className="mt-1 text-sm text-navy/60">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
