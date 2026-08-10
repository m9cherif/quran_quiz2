"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { setParticipant } from "@/store/Slices/participantSlice";
import { joinGame } from "@/services/games";

/**
 * JoinGameForm — student join: nickname + game code → join_competition RPC
 * (server issues the anonymous access token) → /game/[code] lobby.
 */
export function JoinGameForm({ defaultCode = "" }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(defaultCode.toUpperCase());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!/^[A-Z0-9]{3,10}$/.test(trimmedCode)) {
      setError("Enter the game code shown by the host.");
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError("Nickname must be between 2 and 50 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const participant = await joinGame(trimmedCode, trimmedName);
      dispatch(
        setParticipant({
          id: participant.id,
          competitionId: participant.competition_id,
          displayName: participant.display_name,
          accessToken: participant.access_token,
          code: trimmedCode,
          joinedAt: participant.joined_at,
        })
      );
      router.push(`/game/${trimmedCode}`);
    } catch (err) {
      console.error("Join failed:", err);
      if (err?.code === "28000") {
        setError("This game isn't open to join yet. Check the code with your host.");
      } else if (err?.code === "22023") {
        setError(err.message ?? "Check your nickname and try again.");
      } else {
        toast({
          title: "Couldn't join the game",
          description: "Check your connection and try again.",
          variant: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">Join a game</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the game code from your teacher, then pick a nickname.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Input
          label="Your nickname"
          placeholder="e.g. Ahmed"
          required
          autoComplete="nickname"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Game code"
          placeholder="e.g. A1B2C3D4"
          required
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={10}
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
            )
          }
          error={error || undefined}
        />
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          Join game
        </Button>
      </form>
    </Card>
  );
}

export default JoinGameForm;