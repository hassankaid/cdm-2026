// =====================================================================
// sync-fixtures — importe équipes + matchs + groupes depuis API-Football
// Idempotent (upsert). Peut être appelée à la demande ou par cron.
// Sécurité : header x-sync-secret == SYNC_SECRET.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://v3.football.api-sports.io";
const LEAGUE = 1; // FIFA World Cup
const SEASON = 2026;

// Noms de pays en français (clé = nom anglais renvoyé par l'API)
const FR: Record<string, string> = {
  "Mexico": "Mexique", "South Africa": "Afrique du Sud", "South Korea": "Corée du Sud",
  "Czech Republic": "Tchéquie", "Czechia": "Tchéquie", "Canada": "Canada",
  "Bosnia & Herzegovina": "Bosnie-Herzégovine", "Qatar": "Qatar", "Switzerland": "Suisse",
  "Brazil": "Brésil", "Morocco": "Maroc", "Haiti": "Haïti", "Scotland": "Écosse",
  "USA": "États-Unis", "United States": "États-Unis", "Paraguay": "Paraguay",
  "Australia": "Australie", "Türkiye": "Turquie", "Turkey": "Turquie", "Germany": "Allemagne",
  "Curaçao": "Curaçao", "Ivory Coast": "Côte d'Ivoire", "Ecuador": "Équateur",
  "Netherlands": "Pays-Bas", "Japan": "Japon", "Sweden": "Suède", "Tunisia": "Tunisie",
  "Belgium": "Belgique", "Egypt": "Égypte", "Iran": "Iran", "New Zealand": "Nouvelle-Zélande",
  "Spain": "Espagne", "Cape Verde Islands": "Cap-Vert", "Cape Verde": "Cap-Vert",
  "Saudi Arabia": "Arabie saoudite", "Uruguay": "Uruguay", "France": "France",
  "Senegal": "Sénégal", "Iraq": "Irak", "Norway": "Norvège", "Argentina": "Argentine",
  "Algeria": "Algérie", "Austria": "Autriche", "Jordan": "Jordanie", "Portugal": "Portugal",
  "Congo DR": "RD Congo", "DR Congo": "RD Congo", "Uzbekistan": "Ouzbékistan",
  "Colombia": "Colombie", "England": "Angleterre", "Croatia": "Croatie", "Ghana": "Ghana",
  "Panama": "Panama",
};

function mapStatus(short: string): string {
  if (["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled"; // NS, TBD, ...
}

function mapStage(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("group")) return "group";
  if (r.includes("round of 32") || r.includes("1/16")) return "round32";
  if (r.includes("round of 16") || r.includes("1/8")) return "round16";
  if (r.includes("quarter")) return "quarter";
  if (r.includes("semi")) return "semi";
  if (r.includes("3rd place") || r.includes("third place")) return "third_place";
  if (r.includes("final")) return "final";
  return "group";
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("API_FOOTBALL_KEY")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const h = { "x-apisports-key": apiKey };

  const get = (path: string) => fetch(`${API}${path}`, { headers: h }).then((r) => r.json());

  // 1) Équipes
  const teamsRes = await get(`/teams?league=${LEAGUE}&season=${SEASON}`);

  // 2) Groupes (A–L) via standings
  const standRes = await get(`/standings?league=${LEAGUE}&season=${SEASON}`);
  const groupMap = new Map<number, string>();
  for (const grp of standRes.response?.[0]?.league?.standings ?? []) {
    for (const row of grp) {
      const m = /Group\s+([A-L])/i.exec(row.group ?? "");
      if (m) groupMap.set(row.team.id, m[1].toUpperCase());
    }
  }

  // Upsert équipes
  const teamRows = (teamsRes.response ?? []).map((t: any) => ({
    api_team_id: t.team.id,
    fifa_code: t.team.code ?? null,
    name: t.team.name,
    name_fr: FR[t.team.name] ?? t.team.name,
    logo_url: t.team.logo ?? null,
    group_letter: groupMap.get(t.team.id) ?? null,
  }));
  const upTeams = await supabase.from("teams").upsert(teamRows, { onConflict: "api_team_id" });
  if (upTeams.error) {
    return new Response(JSON.stringify({ step: "teams", error: upTeams.error }), { status: 500 });
  }

  // Map api_team_id -> id interne
  const { data: dbTeams } = await supabase.from("teams").select("id, api_team_id");
  const idMap = new Map<number, number>();
  for (const t of dbTeams ?? []) idMap.set(t.api_team_id, t.id);

  // 2b) Classements de groupe (départages calculés par l'API)
  const standingRows: Record<string, unknown>[] = [];
  for (const grp of standRes.response?.[0]?.league?.standings ?? []) {
    for (const row of grp) {
      const gm = /Group\s+([A-L])/i.exec(row.group ?? "");
      if (!gm) continue;
      const tid = idMap.get(row.team.id);
      if (!tid) continue;
      standingRows.push({
        team_id: tid,
        group_letter: gm[1].toUpperCase(),
        rank: row.rank ?? null,
        played: row.all?.played ?? 0,
        win: row.all?.win ?? 0,
        draw: row.all?.draw ?? 0,
        lose: row.all?.lose ?? 0,
        gf: row.all?.goals?.for ?? 0,
        ga: row.all?.goals?.against ?? 0,
        gd: row.goalsDiff ?? 0,
        points: row.points ?? 0,
      });
    }
  }
  if (standingRows.length > 0) {
    await supabase.from("group_standings").upsert(standingRows, { onConflict: "team_id" });
  }

  // 3) Matchs
  const fxRes = await get(`/fixtures?league=${LEAGUE}&season=${SEASON}`);
  const matchRows = (fxRes.response ?? []).map((f: any) => {
    const stage = mapStage(f.league.round ?? "");
    const homeApi = f.teams.home?.id ?? null;
    const awayApi = f.teams.away?.id ?? null;
    const venue = f.fixture.venue?.name
      ? f.fixture.venue.name + (f.fixture.venue.city ? ` · ${f.fixture.venue.city}` : "")
      : null;
    return {
      api_fixture_id: f.fixture.id,
      stage,
      group_letter: stage === "group" ? groupMap.get(homeApi) ?? null : null,
      round_label: f.league.round ?? null,
      home_team_id: homeApi ? idMap.get(homeApi) ?? null : null,
      away_team_id: awayApi ? idMap.get(awayApi) ?? null : null,
      home_placeholder: homeApi ? null : f.teams.home?.name ?? null,
      away_placeholder: awayApi ? null : f.teams.away?.name ?? null,
      kickoff: f.fixture.date,
      venue,
      status: mapStatus(f.fixture.status.short),
      minute: f.fixture.status?.elapsed ?? null,
      home_score: f.goals?.home ?? null,
      away_score: f.goals?.away ?? null,
      home_score_reg: f.score?.fulltime?.home ?? null,
      away_score_reg: f.score?.fulltime?.away ?? null,
    };
  });
  const upMatches = await supabase.from("matches").upsert(matchRows, { onConflict: "api_fixture_id" });
  if (upMatches.error) {
    return new Response(JSON.stringify({ step: "matches", error: upMatches.error }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ ok: true, teams: teamRows.length, matches: matchRows.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
