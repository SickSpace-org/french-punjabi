import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teacher Portal | AngrishFrançais",
  robots: { index: false, follow: false },
};

export default function TeacherRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
