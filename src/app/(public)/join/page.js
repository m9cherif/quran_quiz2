export const metadata = {
  title: "Join a competition",
};

import JoinGameForm from "@/components/join/JoinGameForm";

export default function JoinPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <JoinGameForm />
    </div>
  );
}