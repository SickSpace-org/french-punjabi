import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getQuizHistory } from "@/lib/quiz/getQuizHistory";
import SpeakingQuiz from "@/components/student/SpeakingQuiz";
import Translator from "@/components/student/Translator";

export const revalidate = 0;

export default async function StudentQuizPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  const history = await getQuizHistory(supabase, student.id);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <SpeakingQuiz history={history} />
      <Translator />
    </div>
  );
}
