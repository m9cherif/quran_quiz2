import GameQuestion from "./GameQuestion";

export const metadata = {
  title: "Question",
};

export default async function GameQuestionPage({ params }) {
  const { code } = await params;
  return <GameQuestion code={String(code ?? "").toUpperCase()} />;
}
