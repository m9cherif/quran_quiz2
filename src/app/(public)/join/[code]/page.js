import JoinGameForm from "@/components/join/JoinGameForm";

export const metadata = {
  title: "Join a game",
};

export default async function JoinWithCodePage({ params }) {
  const { code } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <JoinGameForm defaultCode={typeof code === "string" ? code : ""} />
    </div>
  );
}
