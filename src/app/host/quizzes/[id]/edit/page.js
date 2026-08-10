export const metadata = {
  title: "Edit quiz",
};

import QuizEditor from "@/components/quiz/QuizEditor";

export default function EditQuizPage({ params }) {
  const id = typeof params?.id === "string" ? params.id : "";
  return <QuizEditor key={id} quizId={id} />;
}