// =====================================================================
// sync-live — met à jour les matchs EN COURS (scores, minute, statut)
// et insère les événements (buts, buteurs, cartons, remplacements).
// Appelée par cron toutes les minutes ; ne touche l'API QUE s'il y a
// des matchs dans la fenêtre active (garde-fou coût).
// Sécurité : header x-sync-secret == SYNC_SECRET.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const API = "https://v3.football.api-sports.io";

function mapStatus(short: string): string {
  if (["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled";
}

function mapEventType(apiType: string, detail: string): string | null {
  const t = (apiType || "").toLowerCase();
  const d = (detail || "").toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
    if (d.includes("missed")) return "penalty_missed";
    if (d.includes("penalty")) return "penalty_goal";
    return "goal";
  }
  if (t === "card") return d.includes("red") ? "red" : "yellow";
  if (t === "subst") return "subst";
  if (t === "var") return "var";
  return null;
}

const eventKey = (e: {
  type: string;
  minute: number | null;
  player_name: string | null;
  team_id: number | null;
}) => `${e.type}|${e.minute ?? ""}|${e.player_name ?? ""}|${e.team_id ?? ""}`;

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
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Matchs "actifs" : coup d'envoi dans les 4 dernières heures, pas encore terminés
  const fromIso = new Date(nowMs - 4 * 3600 * 1000).toISOString();
  const toIso = new Date(nowMs + 2 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from("matches")
    .select("id, api_fixture_id")
    .gte("kickoff", fromIso)
    .lte("kickoff", toIso)
    .not("status", "in", "(finished,cancelled)");

  if (!active || active.length === 0) {
    await supabase
      .from("sync_state")
      .update({ live_active: false, last_run_at: nowIso, last_live_count: 0 })
      .eq("id", 1);
    return new Response(JSON.stringify({ ok: true, active: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Map api_team_id -> id interne + nom FR (pour les notifs)
  const { data: dbTeams } = await supabase.from("teams").select("id, api_team_id, name, name_fr");
  const teamId = new Map<number, number>();
  const teamName = new Map<number, string>();
  for (const t of dbTeams ?? []) {
    teamId.set(t.api_team_id as number, t.id as number);
    teamName.set(t.api_team_id as number, (t.name_fr as string) ?? (t.name as string));
  }
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const fnHeaders = {
    "Content-Type": "application/json",
    "x-sync-secret": Deno.env.get("SYNC_SECRET") ?? "",
  };

  const ids = active.map((m) => m.api_fixture_id).filter(Boolean).join("-");
  const fxRes = await fetch(`${API}/fixtures?ids=${ids}`, { headers: h }).then((r) => r.json());
  const fixtures = fxRes.response ?? [];

  // Index match interne par api_fixture_id
  const matchByApi = new Map<number, number>();
  for (const m of active) matchByApi.set(m.api_fixture_id as number, m.id as number);

  let liveCount = 0;
  let eventsInserted = 0;

  for (const f of fixtures) {
    const apiId = f.fixture.id as number;
    const matchId = matchByApi.get(apiId);
    if (!matchId) continue;

    const status = mapStatus(f.fixture.status.short);
    if (status === "live") liveCount++;

    await supabase
      .from("matches")
      .update({
        status,
        status_long: f.fixture.status?.long ?? null,
        minute: f.fixture.status?.elapsed ?? null,
        home_score: f.goals?.home ?? null,
        away_score: f.goals?.away ?? null,
        home_score_reg: f.score?.fulltime?.home ?? null,
        away_score_reg: f.score?.fulltime?.away ?? null,
        went_to_extra: !!(f.score?.extratime?.home != null || f.score?.extratime?.away != null),
        went_to_pens: !!(f.score?.penalty?.home != null || f.score?.penalty?.away != null),
        last_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", matchId);

    // Notif de coup d'envoi (une seule fois grâce à notifications_log)
    if (status === "live") {
      const lk = await supabase
        .from("notifications_log")
        .insert({ event_key: `kickoff-${matchId}`, kind: "kickoff" });
      if (!lk.error) {
        const a = teamName.get(f.teams.home?.id) ?? f.teams.home?.name;
        const b = teamName.get(f.teams.away?.id) ?? f.teams.away?.name;
        try {
          await fetch(`${SUPA_URL}/functions/v1/send-push`, {
            method: "POST",
            headers: fnHeaders,
            body: JSON.stringify({
              title: "⚽ Coup d'envoi !",
              body: `${a} - ${b}, c'est parti ! Suis le match en direct 🔴`,
              url: `/matchs/${matchId}`,
              tag: `kickoff-${matchId}`,
            }),
          });
        } catch (_e) {
          // une notif ratée n'interrompt pas la synchro
        }
      }
    }

    // Notif de fin de match (une seule fois grâce à notifications_log)
    if (status === "finished") {
      const logIns = await supabase
        .from("notifications_log")
        .insert({ event_key: `finish-${matchId}`, kind: "fin_match" });
      if (!logIns.error) {
        const facts = {
          equipeA: teamName.get(f.teams.home?.id) ?? f.teams.home?.name,
          equipeB: teamName.get(f.teams.away?.id) ?? f.teams.away?.name,
          score: `${f.score?.fulltime?.home ?? f.goals?.home ?? 0}-${f.score?.fulltime?.away ?? f.goals?.away ?? 0}`,
        };
        try {
          const gen = await fetch(`${SUPA_URL}/functions/v1/generate-notif`, {
            method: "POST",
            headers: fnHeaders,
            body: JSON.stringify({ type: "fin_match", facts }),
          }).then((r) => r.json());
          if (gen?.text) {
            await fetch(`${SUPA_URL}/functions/v1/send-push`, {
              method: "POST",
              headers: fnHeaders,
              body: JSON.stringify({
                title: "🏁 Fin du match",
                body: gen.text,
                url: `/matchs/${matchId}`,
                tag: `finish-${matchId}`,
              }),
            });
          }
        } catch (_e) {
          // une notif ratée n'interrompt pas la synchro
        }
      }
    }

    // Événements du match
    const evRes = await fetch(`${API}/fixtures/events?fixture=${apiId}`, { headers: h }).then((r) =>
      r.json(),
    );
    const apiEvents = evRes.response ?? [];
    if (apiEvents.length === 0) continue;

    // Dédoublonnage + enrichissement (l'API ajoute le buteur APRÈS coup)
    const { data: existing } = await supabase
      .from("match_events")
      .select("id, type, minute, minute_extra, player_name, team_id")
      .eq("match_id", matchId);

    const isGoal = (t: string) => t === "goal" || t === "own_goal" || t === "penalty_goal";
    const stableKey = (t: string, mn: unknown, mx: unknown, tm: unknown) =>
      `${t}|${mn ?? ""}|${mx ?? ""}|${tm ?? ""}`;

    // Buts existants indexés par (type, minute, équipe) → pour compléter le buteur
    const goalByStable = new Map<string, { id: number; player_name: string | null }>();
    const seenFull = new Set<string>();
    for (const e of existing ?? []) {
      if (isGoal(e.type as string)) {
        const k = stableKey(e.type, e.minute, e.minute_extra, e.team_id);
        const cur = goalByStable.get(k);
        if (!cur || (!cur.player_name && e.player_name)) {
          goalByStable.set(k, { id: e.id as number, player_name: (e.player_name as string) ?? null });
        }
      } else {
        seenFull.add(eventKey(e as never));
      }
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: number; player_name: string; assist_name: string | null; detail: string | null }[] = [];
    for (const ev of apiEvents) {
      const type = mapEventType(ev.type, ev.detail);
      if (!type) continue;
      const isSubst = type === "subst";
      const row = {
        match_id: matchId,
        team_id: ev.team?.id ? teamId.get(ev.team.id) ?? null : null,
        type,
        minute: ev.time?.elapsed ?? null,
        minute_extra: ev.time?.extra ?? null,
        player_name: ev.player?.name ?? null,
        assist_name: isSubst ? null : ev.assist?.name ?? null,
        player_out: isSubst ? ev.assist?.name ?? null : null,
        detail: ev.detail ?? null,
      };
      if (isGoal(type)) {
        const k = stableKey(type, row.minute, row.minute_extra, row.team_id);
        const ex = goalByStable.get(k);
        if (ex) {
          // but déjà connu : on complète juste le buteur s'il manquait (pas de doublon)
          if (!ex.player_name && row.player_name && ex.id) {
            toUpdate.push({
              id: ex.id,
              player_name: row.player_name as string,
              assist_name: row.assist_name as string | null,
              detail: row.detail as string | null,
            });
            ex.player_name = row.player_name as string;
          }
          continue;
        }
        goalByStable.set(k, { id: 0, player_name: (row.player_name as string) ?? null });
        toInsert.push(row);
      } else {
        const fk = eventKey(row as never);
        if (seenFull.has(fk)) continue;
        seenFull.add(fk);
        toInsert.push(row);
      }
    }

    // Compléter les buts dont le buteur vient d'arriver
    for (const u of toUpdate) {
      await supabase
        .from("match_events")
        .update({ player_name: u.player_name, assist_name: u.assist_name, detail: u.detail })
        .eq("id", u.id);
    }

    if (toInsert.length > 0) {
      const ins = await supabase.from("match_events").insert(toInsert);
      if (!ins.error) {
        eventsInserted += toInsert.length;

        // Notifs live sur les buts fraîchement détectés
        const newGoals = toInsert.filter((e) =>
          ["goal", "penalty_goal", "own_goal"].includes(e.type as string),
        );
        for (const g of newGoals) {
          const facts = {
            equipeA: teamName.get(f.teams.home?.id) ?? f.teams.home?.name,
            equipeB: teamName.get(f.teams.away?.id) ?? f.teams.away?.name,
            score: `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`,
            minute: g.minute,
            buteur: g.player_name,
          };
          try {
            const gen = await fetch(`${SUPA_URL}/functions/v1/generate-notif`, {
              method: "POST",
              headers: fnHeaders,
              body: JSON.stringify({ type: "live_but", facts }),
            }).then((r) => r.json());
            if (gen?.text) {
              await fetch(`${SUPA_URL}/functions/v1/send-push`, {
                method: "POST",
                headers: fnHeaders,
                body: JSON.stringify({
                  title: "⚽ BUT !",
                  body: gen.text,
                  url: `/matchs/${matchId}`,
                  tag: `goal-${matchId}-${g.minute}-${g.player_name ?? ""}`,
                }),
              });
            }
          } catch (_e) {
            // une notif ratée n'interrompt pas la synchro
          }
        }
      }
    }
  }

  await supabase
    .from("sync_state")
    .update({
      live_active: liveCount > 0,
      last_run_at: nowIso,
      last_live_count: liveCount,
    })
    .eq("id", 1);

  return new Response(
    JSON.stringify({ ok: true, active: active.length, live: liveCount, eventsInserted }),
    { headers: { "Content-Type": "application/json" } },
  );
});
