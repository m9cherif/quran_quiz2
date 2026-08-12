import LiveGameControl from "./LiveGameControl";

export const metadata = {
  title: "Live game",
};

export default async function HostGamePage({ params }) {
  const { roomKey } = await params;
  return <LiveGameControl roomKey={String(roomKey ?? "")} />;
}
