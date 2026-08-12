import GameResult from "./GameResult";

export const metadata = {
  title: "Results",
};

export default async function GameResultPage({ params }) {
  const { code } = await params;
  return <GameResult code={String(code ?? "").toUpperCase()} />;
}
