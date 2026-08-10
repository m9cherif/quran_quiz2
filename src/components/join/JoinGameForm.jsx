"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { setParticipant, setQuestions } from "@/store/Slices/participantSlice";
import { setRoom } from "@/store/Slices/roomSlice";
import API_CONFIG from "@/app/components/API";

/**
 * JoinGameForm — student join: name + game code → legacy join endpoint →
 * store participant/questions → /game/[roomKey].
 */
export function JoinGameForm({ defaultCode = "" }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(defaultCode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = code.trim();
    if (!/^\d{4,12}$/.test(trimmed)) {
      setError("Enter the game code shown by the host.");
      return;
    }

    setIsLoading(true);
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.joinQiuz}`;

    try {
      const response = await fetch(END_POINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room_key: Number(trimmed), name: name.trim() }),
      });

      const responseData = await response.json();

      if (response.status === 200 && responseData?.id) {
        dispatch(
          setParticipant({
            id: responseData.id,
            name: name.trim(),
            room_key: String(responseData.room_key),
          })
        );
        dispatch(setQuestions(responseData.questions));
        dispatch(setRoom(trimmed));
        router.push(`/game/${String(responseData.room_key)}`);
      } else {
        setError("Wrong game code. Check it with the host and try again.");
      }
    } catch (err) {
      console.error("Join failed:", err);
      toast({
        title: "Couldn't join the game",
        description: "Check your connection and try again.",
        variant: "error",
      });
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
          placeholder="e.g. 4821"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
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