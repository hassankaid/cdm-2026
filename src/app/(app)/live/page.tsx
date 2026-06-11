import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match-card";
import { timeIn, dayLabel } from "@/lib/format";

type TeamMini = {
  name: string;
  name_fr: string | null;
  fifa_code: string | null;
  logo_url: string | null;
};
type MatchRow = {
  id: number;
  kickoff: string;
  status: string;
  group_letter: string | null;
  stage: string;
  round_label: string | null;
  venue: string | null;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home: TeamMini | null;
  away: TeamMini | null;
};
type NextRow = {
  kickoff: string;
  home: TeamMini | null;
  away: TeamMini | null;
};

const STAGE_FR: Record<string, string> = {
  round32: "16e de finale",
  round16: "8e de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  third_place: "3e place",
  final: "Finale",
};
const tn = (t: TeamMini | null) => t?.name_fr ?? t?.name ?? "À venir";

export default async function LivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user?.id ?? "")
    .single();
  const tz = profile?.timezone ?? "Europe/Paris";

  const { data: liveData } = await supabase
    .from("matches")
    .select(
      `id, kickoff, status, group_letter, stage, round_label, venue, minute, home_score, away_score,
       home:home_team_id ( name, name_fr, fifa_code, logo_url ),
       away:away_team_id ( name, name_fr, fifa_code, logo_url )`,
    )
    .eq("status", "live")
    .order("kickoff", { ascending: true });
  const live = (liveData ?? []) as unknown as MatchRow[];

  const predMap = new Map<number, { pred_home: number; pred_away: number; points: number | null }>();
  if (live.length > 0 && user) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id, pred_home, pred_away, points")
      .eq("user_id", user.id)
      .in("match_id", live.map((m) => m.id));
    for (const p of preds ?? []) predMap.set(p.match_id, p);
  }

  let next: NextRow | null = null;
  if (live.length === 0) {
    const { data: nx } = await supabase
      .from("matches")
      .select(
        `kickoff, home:home_team_id ( name, name_fr, fifa_code, logo_url ), away:away_team_id ( name, name_fr, fifa_code, logo_url )`,
      )
      .eq("status", "scheduled")
      .gte("kickoff", new Date().toISOString())
      .order("kickoff", { ascending: true })
      .limit(1)
      .maybeSingle();
    next = (nx as unknown as NextRow) ?? null;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-coral" />
        <div className="font-display text-lg leading-none">
          EN <span className="text-coral">DIRECT</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">
        {live.length > 0 ? (
          <div className="flex flex-col gap-3">
            {live.map((m) => {
              const pred = predMap.get(m.id);
              return (
                <MatchCard
                  key={m.id}
                  id={m.id}
                  userId={user?.id ?? ""}
                  timeLabel={timeIn(tz, m.kickoff)}
                  state="live"
                  minute={m.minute}
                  groupLabel={m.group_letter ? `Groupe ${m.group_letter}` : STAGE_FR[m.stage] ?? null}
                  venue={m.venue}
                  home={{ name: tn(m.home), logo: m.home?.logo_url ?? null, code: m.home?.fifa_code ?? null }}
                  away={{ name: tn(m.away), logo: m.away?.logo_url ?? null, code: m.away?.fifa_code ?? null }}
                  homeScore={m.home_score}
                  awayScore={m.away_score}
                  pred={pred ? { home: pred.pred_home, away: pred.pred_away, points: pred.points } : null}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-pitch-900/40 p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-pitch-800 text-3xl">
              🔴
            </div>
            <p className="text-sm font-semibold text-ink">Aucun match en direct</p>
            {next ? (
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                Prochain match :{" "}
                <span className="text-ink">
                  {tn(next.home)} – {tn(next.away)}
                </span>
                <br />
                {dayLabel(tz, next.kickoff)} à {timeIn(tz, next.kickoff)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Reviens pendant un match !</p>
            )}
            <Link
              href="/matchs"
              className="mt-4 inline-block rounded-full border border-line px-4 py-2 text-sm font-semibold text-volt hover:border-volt/50"
            >
              Voir tous les matchs →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
