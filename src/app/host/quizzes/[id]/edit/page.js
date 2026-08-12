import QuizEditor from "@/components/quiz/QuizEditor";

export const metadata = {
  title: "Edit quiz",
};

export default async function EditQuizPage({ params }) {
  const { id } = await params;
  const quizId = typeof id === "string" ? id : "";
  return <QuizEditor key={quizId} quizId={quizId} />;
}
