import LiveGameControl from "./LiveGameControl";

export const metadata = {
  title: "Live competition",
};

export default async function HostGamePage({ params }) {
  const { roomKey } = await params;
  return <LiveGameControl roomKey={String(roomKey ?? "")} />;
}
