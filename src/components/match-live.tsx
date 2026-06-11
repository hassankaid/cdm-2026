"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeIn } from "@/lib/format";

type Team = { id: number; name: string; logo: string | null; code: string | null };
type Ev = {
  id: number;
  type: string;
  minute: number | null;
  minute_extra: number | null;
  player_name: string | null;
  assist_name: string | null;
  player_out: string | null;
  team_id: number | null;
  detail: string | null;
};
type MatchState = {
  status: string;
  status_long: string | null;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  went_to_extra: boolean;
  went_to_pens: boolean;
};
type Pred = {
  user_id: string;
  pred_home: number;
  pred_away: number;
  points: number | null;
  name: string;
};

const EVENT_ICON: Record<string, string> = {
  goal: "⚽",
  own_goal: "⚽",
  penalty_goal: "⚽",
  penalty_missed: "❌",
  yellow: "🟨",
  red: "🟥",
  subst: "🔄",
  var: "📺",
};

function eventLabel(e: Ev): string {
  if (e.type === "own_goal") return `${e.player_name ?? ""} (csc)`;
  if (e.type === "penalty_goal") return `${e.player_name ?? ""} (pen.)`;
  if (e.type === "penalty_missed") return `Pénalty manqué — ${e.player_name ?? ""}`;
  if (e.type === "subst")
    return `${e.player_name ?? "?"} ↑${e.player_out ? ` · ${e.player_out} ↓` : ""}`;
  if (e.type === "goal")
    return `${e.player_name ?? ""}${e.assist_name ? ` (passe ${e.assist_name})` : ""}`;
  return e.player_name ?? e.detail ?? "";
}

function Flag({ team, size = 40 }: { team: Team; size?: number }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={team.logo}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-pitch-700 text-[10px] font-bold text-muted"
    >
      {team.code ?? "?"}
    </div>
  );
}

export function MatchLive(props: {
  matchId: number;
  tz: string;
  myUserId: string;
  kickoffISO: string;
  groupLabel: string | null;
  venue: string | null;
  home: Team;
  away: Team;
  initialMatch: MatchState;
  initialEvents: Ev[];
  preds: Pred[];
}) {
  const { matchId, tz, myUserId, kickoffISO, groupLabel, venue, home, away, preds } = props;
  const [m, setM] = useState<MatchState>(props.initialMatch);
  const [events, setEvents] = useState<Ev[]>(props.initialEvents);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload) => setM((prev) => ({ ...prev, ...(payload.new as Partial<MatchState>) })),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const ne = payload.new as Ev;
          setEvents((prev) =>
            prev.some((e) => e.id === ne.id)
              ? prev
              : [...prev, ne].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const live = m.status === "live";
  const finished = m.status === "finished";
  const showScore = live || finished;
  const myPred = preds.find((p) => p.user_id === myUserId);
  const others = preds
    .filter((p) => p.user_id !== myUserId)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <Link href="/matchs" className="text-sm text-muted transition-colors hover:text-ink">
          ← Matchs
        </Link>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">
          {groupLabel}
        </div>
        <div className="w-14" />
      </header>

      <main className="flex-1 px-4 pb-24 pt-6">
        {/* Tableau de score */}
        <section className="rise rounded-3xl border border-line bg-pitch-900/50 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <Flag team={home} />
              <span className="text-sm font-semibold leading-tight text-ink">{home.name}</span>
            </div>
            <div className="flex flex-col items-center">
              {showScore ? (
                <div className="font-display text-5xl tabular-nums text-ink">
                  {m.home_score ?? 0}
                  <span className="mx-1 text-muted">:</span>
                  {m.away_score ?? 0}
                </div>
              ) : (
                <div className="font-display text-3xl text-ink">{timeIn(tz, kickoffISO)}</div>
              )}
              <div className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                {live ? (
                  <span className="inline-flex items-center gap-1.5 text-coral">
                    <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-coral" />
                    {m.minute ? `${m.minute}'` : "Direct"}
                  </span>
                ) : finished ? (
                  <span className="text-muted">
                    Terminé
                    {m.went_to_pens ? " (t.a.b.)" : m.went_to_extra ? " (a.p.)" : ""}
                  </span>
                ) : (
                  <span className="text-muted">À venir</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <Flag team={away} />
              <span className="text-sm font-semibold leading-tight text-ink">{away.name}</span>
            </div>
          </div>
          {venue && <p className="mt-4 text-center text-[11px] text-muted">{venue}</p>}
        </section>

        {/* Discussion du match */}
        <Link
          href={`/matchs/${matchId}/chat`}
          className="rise mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line bg-pitch-900/50 py-3 text-sm font-semibold text-ink transition-colors hover:border-volt/50"
        >
          💬 Discussion du match
        </Link>

        {/* Ton prono */}
        <section className="rise mt-4" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between rounded-2xl border border-line bg-pitch-900/40 px-4 py-3">
            <span className="text-sm text-muted">Ton prono</span>
            {myPred ? (
              <span className="font-display text-lg text-ink">
                {myPred.pred_home}–{myPred.pred_away}
                {finished && myPred.points != null && (
                  <span
                    className={`ml-2 text-sm ${myPred.points > 0 ? "text-volt" : "text-muted"}`}
                  >
                    +{myPred.points}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-sm text-muted/60">Aucun prono</span>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section className="rise mt-6" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-ink">
            Fil du match
          </h2>
          {events.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-pitch-900/30 px-4 py-6 text-center text-sm text-muted">
              {live ? "Ça va démarrer…" : finished ? "Aucun événement notable." : "Le fil s'animera dès le coup d'envoi."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map((e) => {
                const isHome = e.team_id === home.id;
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 ${isHome ? "" : "flex-row-reverse text-right"}`}
                  >
                    <span className="w-9 shrink-0 text-center font-display text-sm tabular-nums text-muted">
                      {e.minute ?? "?"}
                      {e.minute_extra ? `+${e.minute_extra}` : ""}&apos;
                    </span>
                    <span className="text-lg">{EVENT_ICON[e.type] ?? "•"}</span>
                    <span className="flex-1 text-sm text-ink">{eventLabel(e)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pronos des autres (visibles après le coup d'envoi) */}
        {others.length > 0 && (
          <section className="rise mt-6" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 font-display text-base uppercase tracking-wide text-ink">
              Les pronos du groupe
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-pitch-900/40">
              {others.map((p, i) => (
                <div
                  key={p.user_id}
                  className="flex items-center gap-3 border-b border-line/50 px-4 py-2.5 last:border-0"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pitch-800 text-xs font-bold text-ink">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-sm text-ink">{p.name}</span>
                  <span className="font-display text-base tabular-nums text-muted">
                    {p.pred_home}–{p.pred_away}
                  </span>
                  {finished && p.points != null && (
                    <span className={`w-8 text-right text-xs font-bold ${p.points > 0 ? "text-volt" : "text-muted"}`}>
                      +{p.points}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
