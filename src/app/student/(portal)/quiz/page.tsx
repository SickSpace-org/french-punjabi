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
    <div className="space-y-6">
      <p className="font-display text-2xl font-bold text-navy">Speaking Quiz</p>
      <SpeakingQuiz history={history} />
      <Translator />
    </div>
  );
}
