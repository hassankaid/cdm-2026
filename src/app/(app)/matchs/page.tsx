import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match-card";
import { timeIn, dayKey, dayLabel } from "@/lib/format";

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
type Pred = { match_id: number; pred_home: number; pred_away: number; points: number | null };

const STAGE_FR: Record<string, string> = {
  round32: "16e de finale",
  round16: "8e de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  third_place: "3e place",
  final: "Finale",
};

function teamName(t: TeamMini | null): string {
  return t?.name_fr ?? t?.name ?? "À venir";
}

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const tz = profile?.timezone ?? "Europe/Paris";

  const { data: matchesData } = await supabase
    .from("matches")
    .select(
      `id, kickoff, status, group_letter, stage, round_label, venue, minute,
       home_score, away_score,
       home:home_team_id ( name, name_fr, fifa_code, logo_url ),
       away:away_team_id ( name, name_fr, fifa_code, logo_url )`,
    )
    .order("kickoff", { ascending: true });
  const matches = (matchesData ?? []) as unknown as MatchRow[];

  const { data: predsData } = await supabase
    .from("predictions")
    .select("match_id, pred_home, pred_away, points")
    .eq("user_id", user.id);
  const predMap = new Map<number, Pred>();
  for (const p of (predsData ?? []) as Pred[]) predMap.set(p.match_id, p);

  const now = Date.now();

  const days: { key: string; label: string; matches: MatchRow[] }[] = [];
  for (const m of matches) {
    const key = dayKey(tz, m.kickoff);
    let day = days.find((d) => d.key === key);
    if (!day) {
      day = { key, label: dayLabel(tz, m.kickoff), matches: [] };
      days.push(day);
    }
    day.matches.push(m);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Accueil
        </Link>
        <div className="font-display text-lg leading-none">
          LES <span className="text-volt">MATCHS</span>
        </div>
        <Link
          href="/groupes"
          className="text-sm font-semibold text-volt transition-colors hover:text-volt-soft"
        >
          Groupes →
        </Link>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        {days.map((day, di) => (
          <section key={day.key} className="rise mb-7" style={{ animationDelay: `${di * 0.03}s` }}>
            <div className="sticky top-[57px] z-30 -mx-4 mb-3 flex items-baseline gap-2 bg-pitch-950/90 px-4 py-2 backdrop-blur">
              <h2 className="font-display text-base uppercase tracking-wide text-ink">
                {day.label}
              </h2>
              <span className="text-xs text-muted">
                {day.matches.length} match{day.matches.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {day.matches.map((m) => {
                const ko = new Date(m.kickoff).getTime();
                const state =
                  m.status === "live"
                    ? "live"
                    : m.status === "finished"
                      ? "finished"
                      : ko <= now
                        ? "locked"
                        : "open";
                const groupLabel = m.group_letter
                  ? `Groupe ${m.group_letter}`
                  : STAGE_FR[m.stage] ?? null;
                const pred = predMap.get(m.id);

                return (
                  <MatchCard
                    key={m.id}
                    id={m.id}
                    userId={user.id}
                    timeLabel={timeIn(tz, m.kickoff)}
                    state={state}
                    minute={m.minute}
                    groupLabel={groupLabel}
                    venue={m.venue}
                    home={{
                      name: teamName(m.home),
                      logo: m.home?.logo_url ?? null,
                      code: m.home?.fifa_code ?? null,
                    }}
                    away={{
                      name: teamName(m.away),
                      logo: m.away?.logo_url ?? null,
                      code: m.away?.fifa_code ?? null,
                    }}
                    homeScore={m.home_score}
                    awayScore={m.away_score}
                    pred={pred ? { home: pred.pred_home, away: pred.pred_away, points: pred.points } : null}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
