"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useI18n } from "@/lib/i18n/I18nProvider";

const TEAMS = ["", "Team A", "Team B", "Team C", "Team D", "Team E", "Team F"];

/**
 * HostPlayerTools — per-player controls in the control room: put someone on a
 * team, hand out (or take away) points by hand, and remove a player who should
 * not be in the room. Destructive removal asks first.
 */
export default function HostPlayerTools({
  players,
  onlineIds,
  onSetTeam,
  onAward,
  onRemove,
  onShuffleTeams,
}) {
  const { t } = useI18n();
  const [bonusFor, setBonusFor] = useState(null);
  const [bonusValue, setBonusValue] = useState(5);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [teamCount, setTeamCount] = useState(2);

  const confirmAward = async () => {
    if (!bonusFor) return;
    setBusy(true);
    try {
      await onAward(bonusFor.id, Number(bonusValue) || 0);
      setBonusFor(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await onRemove(removeTarget.id);
      setRemoveTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
        <span className="text-xs font-semibold text-ink-muted">{t("teams.label")}</span>
        <Select
          aria-label={t("teams.count")}
          value={String(teamCount)}
          onChange={(e) => setTeamCount(Number(e.target.value))}
          className="h-8 w-auto py-0 text-xs"
        >
          {[0, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? t("teams.none") : t("teams.nTeams", { n })}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="outline" onClick={() => onShuffleTeams(teamCount)}>
          {t("teams.shuffle")}
        </Button>
      </div>

      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {players.map((p) => {
          // Presence is the truth; the stored flag was never cleared.
          const online = onlineIds?.has(p.id) ?? false;
          return (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span
              title={online ? t("host.online") : t("host.away")}
              className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-success" : "bg-ink-faint"}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.display_name}</span>
            {p.team && <Badge variant="info">{p.team}</Badge>}
            {p.bonus_award > 0 && <Badge variant="success">+{Math.round(p.bonus_award)}</Badge>}
            <select
              value={p.team ?? ""}
              onChange={(e) => onSetTeam(p.id, e.target.value)}
              aria-label={t("teams.setFor", { name: p.display_name })}
              className="h-7 rounded border border-border bg-surface px-1 text-xs text-ink"
            >
              {TEAMS.map((team) => (
                <option key={team || "none"} value={team}>
                  {team || t("teams.none")}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setBonusValue(5);
                setBonusFor(p);
              }}
              className="rounded border border-border px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink"
            >
              {t("teams.points")}
            </button>
            <button
              type="button"
              onClick={() => setRemoveTarget(p)}
              className="rounded border border-border px-1.5 py-0.5 text-xs text-danger"
            >
              {t("teams.remove")}
            </button>
          </li>
          );
        })}
      </ul>

      <Dialog
        open={bonusFor !== null}
        onClose={() => setBonusFor(null)}
        size="sm"
        title={t("teams.awardTitle")}
        description={bonusFor ? t("teams.awardDesc", { name: bonusFor.display_name }) : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBonusFor(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirmAward} loading={busy}>
              {t("teams.award")}
            </Button>
          </>
        }
      >
        <Input
          label={t("common.points")}
          type="number"
          min={-100}
          max={100}
          value={bonusValue}
          onChange={(e) => setBonusValue(e.target.value)}
          hint={t("teams.awardHint")}
        />
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        size="sm"
        title={t("teams.removeTitle")}
        description={removeTarget ? t("teams.removeDesc", { name: removeTarget.display_name }) : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmRemove} loading={busy} icon="trash">
              {t("teams.remove")}
            </Button>
          </>
        }
      />
    </>
  );
}
