import AdminAiChat from "@/components/admin/ai/AdminAiChat";

export default function AdminAiAssistantPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">AI Assistant</h1>
      <p className="mt-1 text-sm text-navy/60">
        Manage Courses, Students, Enrollments, Test Slots, and Comments in plain language —
        create/edit/swap batches, look up a student&apos;s course/attendance/fees, confirm a payment,
        reply to a lesson question, and more. Every change it makes is a real change, just like
        doing it by hand. Course video/lesson content isn&apos;t covered — manage that on Content.
      </p>

      <div className="mt-6">
        <AdminAiChat />
      </div>
    </div>
  );
}
