"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import useSupabase from "@/app/hooks/useSupabase";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import LeaderBoard from "@/app/components/LeftPane/LeaderBoard";
import { cleanLeaderboard } from "@/store/Slices/leaderBoardSlice";
import { setRoom } from "@/store/Slices/roomSlice";
import API_CONFIG from "@/app/components/API";

const noop = () => {};

/**
 * LiveGameControl — host screen for a running game.
 * Left: realtime leaderboard (postgres_changes on NEXT_PUBLIC_DB_TABLE).
 * Right: join code + copy, Start (broadcast), Delete (legacy endpoint).
 */
export default function LiveGameControl({ roomKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();

  const roomKeyStore = useSelector((state) => state.room_key.room_key);
  const user = useSelector((state) => state.user.user);

  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startError, setStartError] = useState("");
  const channelRef = useRef(null);

  useEffect(() => {
    if (roomKey) dispatch(setRoom(roomKey));
  }, [roomKey, dispatch]);

  const roomKeyValue = String(roomKeyStore ?? roomKey ?? "");

  const sendStart = () => {
    setStartError("");
    const channel = supabase.channel(roomKeyValue);
    channelRef.current = channel;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "cursor-pos",
          payload: { message: "Start" },
        });
      }
    });
  };

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  const copyCode = () => {
    navigator.clipboard
      .writeText(roomKeyValue)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast({ title: "Copy failed", variant: "error", description: "Could not copy the code." });
      });
  };

  const deleteRoom = async () => {
    setDeleting(true);
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.deleteRoom}`;

    try {
      const response = await fetch(END_POINT, {
        method: "DELETE",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({ user_id: user?.user_id, room_key: roomKeyValue }),
      });

      if (response.ok) {
        dispatch(cleanLeaderboard());
        toast({ title: "Room deleted", variant: "success" });
        router.push("/host/games");
      } else {
        toast({
          title: "Couldn't delete the room",
          description: "Check your session and try again.",
          variant: "error",
        });
      }
    } catch (err) {
      console.error("Delete room failed:", err);
      toast({
        title: "Couldn't delete the room",
        description: "Check your connection and try again.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-ink">Leaderboard</h2>
        </div>
        <LeaderBoard setRightComponent={noop} setLeftComponent={noop} />
      </Card>

      <div className="space-y-4">
        <Card padding="lg">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Share the game code</h2>
            <Badge variant="success" dot>
              Lobby open
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p
              className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-ink"
              aria-label="Game code"
            >
              {roomKeyValue || "—"}
            </p>
            <Button variant="outline" onClick={copyCode}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <p className="mt-3 text-sm text-ink-muted">
            Students go to{" "}
            <span className="font-medium text-ink">/join</span> and enter this code to
            join the lobby.
          </p>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Game controls</h2>
          <Button onClick={sendStart} size="lg" className="w-full">
            Start quiz
          </Button>
          {startError && (
            <p className="text-sm text-danger" role="alert">
              {startError}
            </p>
          )}
          <Button variant="danger" size="lg" className="w-full" onClick={() => setDeleteOpen(true)}>
            Delete room
          </Button>
        </Card>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this room?"
        description="Students in the lobby will be disconnected. The quiz history stays available."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={deleteRoom}>
              Delete room
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This action cannot be undone.</p>
      </Dialog>
    </div>
  );
}