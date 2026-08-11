"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { setParticipant } from "@/store/Slices/participantSlice";
import { joinGame } from "@/services/games";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * JoinGameForm — student join: nickname + game code → join_competition RPC
 * (server issues the anonymous access token) → /game/[code] lobby.
 * When signed in, the session profile is linked so the game will show up in
 * the student's history.
 */
export function JoinGameForm({ defaultCode = "" }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(defaultCode.toUpperCase());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { t } = useI18n();
  const user = useSelector((state) => state.user.user);
  const profileId = user?.id ?? null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!/^[A-Z0-9]{3,10}$/.test(trimmedCode)) {
      setError(t("join.codeError"));
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError(t("join.nickError"));
      return;
    }

    setIsLoading(true);
    try {
      const participant = await joinGame(trimmedCode, trimmedName, profileId);
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
      if (err?.code === "P0003") {
        setError(t("join.draftError"));
      } else if (err?.code === "P0004") {
        setError(t("join.classCodeError"));
      } else if (err?.code === "28000") {
        setError(t("join.notOpenError"));
      } else if (err?.code === "22023") {
        setError(err.message ?? t("join.nickError"));
      } else {
        toast({
          title: t("join.genericErrorTitle"),
          description: t("join.genericErrorDesc"),
          variant: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card padding="lg" className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-semibold text-ink">{t("join.title")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("join.subtitle")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <Input
          label={t("join.nickname")}
          placeholder={t("join.nicknamePlaceholder")}
          required
          autoComplete="nickname"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t("join.gameCode")}
          placeholder={t("join.gameCodePlaceholder")}
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
          {t("join.joinButton")}
        </Button>
      </form>
    </Card>
  );
}

export default JoinGameForm;