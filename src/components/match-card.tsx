"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Team = { name: string; logo: string | null; code: string | null };
type Pred = { home: number; away: number; points: number | null } | null;
type State = "open" | "live" | "finished" | "locked";
type SaveState = "idle" | "saving" | "saved" | "error";

const clamp = (n: number) => Math.max(0, Math.min(20, n));

export function MatchCard(props: {
  id: number;
  userId: string;
  timeLabel: string;
  state: State;
  minute: number | null;
  groupLabel: string | null;
  venue: string | null;
  home: Team;
  away: Team;
  homeScore: number | null;
  awayScore: number | null;
  pred: Pred;
}) {
  const { id, userId, timeLabel, state, minute, groupLabel, venue, home, away, homeScore, awayScore, pred } = props;
  const editable = state === "open";

  const [h, setH] = useState<number | null>(pred?.home ?? null);
  const [a, setA] = useState<number | null>(pred?.away ?? null);
  const [save, setSave] = useState<SaveState>("idle");

  async function persist(nh: number, na: number) {
    setSave("saving");
    const { error } = await createClient()
      .from("predictions")
      .upsert(
        { user_id: userId, match_id: id, pred_home: nh, pred_away: na },
        { onConflict: "user_id,match_id" },
      );
    setSave(error ? "error" : "saved");
    if (!error) setTimeout(() => setSave("idle"), 1600);
  }

  function bump(side: "h" | "a", d: number) {
    const nh = side === "h" ? clamp((h ?? 0) + d) : h ?? 0;
    const na = side === "a" ? clamp((a ?? 0) + d) : a ?? 0;
    setH(nh);
    setA(na);
    void persist(nh, na);
  }

  const decided =
    (state === "finished" || state === "live") && homeScore != null && awayScore != null;
  const homeLost = decided && (homeScore as number) < (awayScore as number);
  const awayLost = decided && (awayScore as number) < (homeScore as number);

  return (
    <div className="rounded-2xl border border-line bg-pitch-900/50 p-4">
      {/* Méta */}
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <StatusBadge state={state} minute={minute} timeLabel={timeLabel} />
        {groupLabel && (
          <span className="shrink-0 rounded-full bg-pitch-800 px-2.5 py-1 text-[11px] font-semibold text-muted">
            {groupLabel}
          </span>
        )}
      </div>
      {venue && <p className="mb-3 text-[11px] leading-snug text-muted">{venue}</p>}

      {/* Équipes */}
      <div className="flex flex-col gap-2.5">
        <TeamRow
          team={home}
          score={editable ? h : homeScore}
          editable={editable}
          dim={homeLost}
          onUp={() => bump("h", 1)}
          onDown={() => bump("h", -1)}
        />
        <TeamRow
          team={away}
          score={editable ? a : awayScore}
          editable={editable}
          dim={awayLost}
          onUp={() => bump("a", 1)}
          onDown={() => bump("a", -1)}
        />
      </div>

      {/* Pied */}
      <Footer state={state} save={save} pred={pred} editable={editable} />

      <div className="mt-2 flex items-center justify-center gap-4">
        <Link
          href={`/matchs/${id}`}
          className={`text-[11px] font-semibold transition-colors ${
            state === "live" ? "text-coral hover:text-coral/80" : "text-muted/70 hover:text-volt"
          }`}
        >
          {state === "live" ? "Suivre en direct →" : "Détail & fil →"}
        </Link>
        <Link
          href={`/matchs/${id}/chat`}
          className="text-[11px] font-semibold text-muted/70 transition-colors hover:text-volt"
        >
          💬 Discussion
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({
  state,
  minute,
  timeLabel,
}: {
  state: State;
  minute: number | null;
  timeLabel: string;
}) {
  if (state === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-coral">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-coral" />
        {minute ? `${minute}'` : "Direct"}
      </span>
    );
  }
  if (state === "finished") {
    return (
      <span className="rounded-full bg-pitch-800 px-2.5 py-1 text-[11px] font-semibold text-muted">
        Terminé
      </span>
    );
  }
  if (state === "locked") {
    return (
      <span className="text-sm font-bold text-muted">
        {timeLabel} <span className="text-xs">🔒</span>
      </span>
    );
  }
  return <span className="text-sm font-bold tabular-nums text-ink">{timeLabel}</span>;
}

function TeamRow({
  team,
  score,
  editable,
  dim,
  onUp,
  onDown,
}: {
  team: Team;
  score: number | null;
  editable: boolean;
  dim: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Flag team={team} />
      <span
        className={`flex-1 text-[15px] font-semibold leading-tight ${dim ? "text-muted" : "text-ink"}`}
      >
        {team.name}
      </span>
      {editable ? (
        <div className="flex items-center gap-1.5">
          <StepBtn dir="down" onClick={onDown} />
          <span className="w-7 text-center font-display text-2xl tabular-nums text-ink">
            {score ?? "–"}
          </span>
          <StepBtn dir="up" onClick={onUp} />
        </div>
      ) : (
        <span
          className={`w-7 text-center font-display text-2xl tabular-nums ${dim ? "text-muted" : "text-ink"}`}
        >
          {score ?? "–"}
        </span>
      )}
    </div>
  );
}

function StepBtn({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "up" ? "+1" : "-1"}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-pitch-950 text-lg leading-none transition-colors ${
        dir === "up"
          ? "text-volt hover:border-volt/60 hover:bg-volt/10"
          : "text-muted hover:border-coral/60 hover:bg-coral/10 hover:text-coral"
      }`}
    >
      {dir === "up" ? "+" : "−"}
    </button>
  );
}

function Footer({
  state,
  save,
  pred,
  editable,
}: {
  state: State;
  save: SaveState;
  pred: Pred;
  editable: boolean;
}) {
  if (editable) {
    return (
      <div className="mt-3 h-4 text-center text-[11px] font-semibold uppercase tracking-wider">
        {save === "saved" ? (
          <span className="text-volt">Prono enregistré ✓</span>
        ) : save === "saving" ? (
          <span className="text-muted">Enregistrement…</span>
        ) : save === "error" ? (
          <span className="text-coral">Erreur — réessaie</span>
        ) : (
          <span className="text-muted/60">
            {pred ? `Ton prono : ${pred.home}–${pred.away}` : "Choisis ton score"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line/50 pt-2.5 text-center text-[11px]">
      {pred ? (
        <span className="text-muted">
          Ton prono : <span className="font-semibold text-ink">{pred.home}–{pred.away}</span>
          {state === "finished" && pred.points != null && (
            <span className={`ml-1.5 font-bold ${pred.points > 0 ? "text-volt" : "text-muted"}`}>
              +{pred.points} pt{pred.points > 1 ? "s" : ""}
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted/60">Pas de prono sur ce match</span>
      )}
    </div>
  );
}

function Flag({ team }: { team: Team }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={team.logo}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pitch-700 text-[9px] font-bold text-muted">
      {team.code ?? "?"}
    </div>
  );
}
