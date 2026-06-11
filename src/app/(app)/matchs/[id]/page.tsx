import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchLive } from "@/components/match-live";

type TeamMini = {
  id: number;
  name: string;
  name_fr: string | null;
  fifa_code: string | null;
  logo_url: string | null;
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

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

  const { data: match } = await supabase
    .from("matches")
    .select(
      `id, kickoff, status, status_long, minute, group_letter, stage, round_label, venue,
       home_score, away_score, home_score_reg, away_score_reg, went_to_extra, went_to_pens,
       home_team_id, away_team_id,
       home:home_team_id ( id, name, name_fr, fifa_code, logo_url ),
       away:away_team_id ( id, name, name_fr, fifa_code, logo_url )`,
    )
    .eq("id", matchId)
    .single();

  if (!match) notFound();

  const { data: events } = await supabase
    .from("match_events")
    .select("id, type, minute, minute_extra, player_name, assist_name, player_out, team_id, detail")
    .eq("match_id", matchId)
    .order("minute", { ascending: true })
    .order("id", { ascending: true });

  const { data: predsRaw } = await supabase
    .from("predictions")
    .select("user_id, pred_home, pred_away, points, profiles(display_name)")
    .eq("match_id", matchId);

  const home = match.home as unknown as TeamMini | null;
  const away = match.away as unknown as TeamMini | null;

  const preds = (predsRaw ?? []).map((p) => ({
    user_id: p.user_id as string,
    pred_home: p.pred_home as number,
    pred_away: p.pred_away as number,
    points: p.points as number | null,
    name:
      ((p.profiles as unknown as { display_name: string } | null)?.display_name) ??
      "Joueur",
  }));

  return (
    <MatchLive
      matchId={matchId}
      tz={tz}
      myUserId={user.id}
      kickoffISO={match.kickoff as string}
      groupLabel={
        match.group_letter ? `Groupe ${match.group_letter}` : match.round_label ?? null
      }
      venue={match.venue as string | null}
      home={{
        id: home?.id ?? 0,
        name: home?.name_fr ?? home?.name ?? "À venir",
        logo: home?.logo_url ?? null,
        code: home?.fifa_code ?? null,
      }}
      away={{
        id: away?.id ?? 0,
        name: away?.name_fr ?? away?.name ?? "À venir",
        logo: away?.logo_url ?? null,
        code: away?.fifa_code ?? null,
      }}
      initialMatch={{
        status: match.status as string,
        status_long: match.status_long as string | null,
        minute: match.minute as number | null,
        home_score: match.home_score as number | null,
        away_score: match.away_score as number | null,
        went_to_extra: match.went_to_extra as boolean,
        went_to_pens: match.went_to_pens as boolean,
      }}
      initialEvents={events ?? []}
      preds={preds}
    />
  );
}
