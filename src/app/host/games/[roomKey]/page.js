export const metadata = {
  title: "Live game",
};

import LiveGameControl from "./LiveGameControl";

export default function HostGamePage({ params }) {
  return <LiveGameControl roomKey={String(params?.roomKey ?? "")} />;
}