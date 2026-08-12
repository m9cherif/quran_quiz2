import GameLobby from "./GameLobby";

export const metadata = {
  title: "Game lobby",
};

export default async function GameLobbyPage({ params }) {
  const { code } = await params;
  return <GameLobby code={String(code ?? "").toUpperCase()} />;
}
