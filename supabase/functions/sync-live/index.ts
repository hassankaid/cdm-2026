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
  const teamName = new Map<number, string>(); // api_team_id -> nom
  const teamNameById = new Map<number, string>(); // id interne -> nom
  for (const t of dbTeams ?? []) {
    const nm = (t.name_fr as string) ?? (t.name as string);
    teamId.set(t.api_team_id as number, t.id as number);
    teamName.set(t.api_team_id as number, nm);
    teamNameById.set(t.id as number, nm);
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

    // Mi-temps : repère dans le fil + notif (une seule fois)
    if (f.fixture.status?.short === "HT") {
      const htLog = await supabase
        .from("notifications_log")
        .insert({ event_key: `ht-${matchId}`, kind: "mi_temps" });
      if (!htLog.error) {
        const score = `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`;
        await supabase.from("match_events").insert({
          match_id: matchId,
          team_id: null,
          type: "halftime",
          minute: f.fixture.status?.elapsed ?? 45,
          minute_extra: null,
          player_name: null,
          assist_name: null,
          player_out: null,
          detail: score,
        });
        const facts = {
          equipeA: teamName.get(f.teams.home?.id) ?? f.teams.home?.name,
          equipeB: teamName.get(f.teams.away?.id) ?? f.teams.away?.name,
          score,
        };
        try {
          const gen = await fetch(`${SUPA_URL}/functions/v1/generate-notif`, {
            method: "POST",
            headers: fnHeaders,
            body: JSON.stringify({ type: "mi_temps", facts }),
          }).then((r) => r.json());
          if (gen?.text) {
            await fetch(`${SUPA_URL}/functions/v1/send-push`, {
              method: "POST",
              headers: fnHeaders,
              body: JSON.stringify({
                title: "⏸️ Mi-temps",
                body: gen.text,
                url: `/matchs/${matchId}`,
                tag: `ht-${matchId}`,
              }),
            });
          }
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
        // Repère "fin du match" dans le fil
        await supabase.from("match_events").insert({
          match_id: matchId,
          team_id: null,
          type: "fulltime",
          minute: f.fixture.status?.elapsed ?? 90,
          minute_extra: null,
          player_name: null,
          assist_name: null,
          player_out: null,
          detail: `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}`,
        });
        // Buteurs (déjà en base via les synchros live)
        const { data: goalEvents } = await supabase
          .from("match_events")
          .select("player_name, minute")
          .eq("match_id", matchId)
          .in("type", ["goal", "penalty_goal", "own_goal"])
          .order("minute", { ascending: true });
        const buteurs = (goalEvents ?? []).map(
          (g) => `${g.player_name ?? "?"} ${g.minute ?? "?"}'`,
        );

        // Tops / flops du match : le scoring a déjà rempli predictions.points
        // au passage en "finished" (trigger recompute_match_points).
        const { data: preds } = await supabase
          .from("predictions")
          .select("pred_home, pred_away, points, profiles(display_name)")
          .eq("match_id", matchId)
          .not("points", "is", null)
          .order("points", { ascending: false });
        const hs = f.goals?.home ?? 0;
        const as = f.goals?.away ?? 0;
        const pname = (p: { profiles?: unknown }): string => {
          const pr = p.profiles as
            | { display_name?: string }
            | { display_name?: string }[]
            | null;
          return (
            (Array.isArray(pr) ? pr[0]?.display_name : pr?.display_name) ?? "Quelqu'un"
          );
        };
        let boss: { noms: string; points: number } | null = null;
        let clown: { nom: string; prono: string } | null = null;
        if (preds && preds.length) {
          const maxP = preds[0].points as number;
          const minP = preds[preds.length - 1].points as number;
          if (maxP > 0) {
            const tops = preds.filter((p) => p.points === maxP);
            boss = { noms: tops.map(pname).join(" & "), points: maxP };
          }
          if (minP < maxP) {
            // Le clown = le prono le plus à l'opposé du vrai score
            const flops = preds.filter((p) => p.points === minP);
            const wrong = (p: { pred_home: number; pred_away: number }) =>
              Math.abs((p.pred_home ?? 0) - hs) + Math.abs((p.pred_away ?? 0) - as);
            flops.sort((a, b) => wrong(b) - wrong(a));
            clown = {
              nom: pname(flops[0]),
              prono: `${flops[0].pred_home}-${flops[0].pred_away}`,
            };
          }
        }
        const aName = teamName.get(f.teams.home?.id) ?? f.teams.home?.name;
        const bName = teamName.get(f.teams.away?.id) ?? f.teams.away?.name;
        const facts = {
          equipeA: aName,
          equipeB: bName,
          score: `${f.score?.fulltime?.home ?? hs}-${f.score?.fulltime?.away ?? as}`,
          vainqueur: hs > as ? aName : as > hs ? bName : "Match nul",
          buteurs,
          boss,
          clown,
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
    // Événements hors-but (carton, remplacement, var) : dédoublonnage TOLÉRANT à la
    // minute — l'API révise parfois la minute d'un même événement de ±1 d'une synchro
    // à l'autre (ex. carton rouge passé de 50' à 49'), ce qui créait des doublons.
    const NON_GOAL_TOL = 3;
    const nonGoals: {
      type: string;
      minute: number | null;
      player_name: string | null;
      team_id: number | null;
    }[] = [];
    const nonGoalDup = (
      type: string,
      minute: number | null,
      player: string | null,
      team: number | null,
    ) =>
      nonGoals.some(
        (e) =>
          e.type === type &&
          (e.player_name ?? "") === (player ?? "") &&
          (e.team_id ?? null) === (team ?? null) &&
          Math.abs((e.minute ?? 0) - (minute ?? 0)) <= NON_GOAL_TOL,
      );
    for (const e of existing ?? []) {
      if (isGoal(e.type as string)) {
        const k = stableKey(e.type, e.minute, e.minute_extra, e.team_id);
        const cur = goalByStable.get(k);
        if (!cur || (!cur.player_name && e.player_name)) {
          goalByStable.set(k, { id: e.id as number, player_name: (e.player_name as string) ?? null });
        }
      } else {
        nonGoals.push({
          type: e.type as string,
          minute: e.minute as number | null,
          player_name: (e.player_name as string) ?? null,
          team_id: (e.team_id as number) ?? null,
        });
      }
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: {
      id: number;
      player_name: string;
      assist_name: string | null;
      detail: string | null;
      minute: number | null;
      minute_extra: number | null;
      team_id: number | null;
    }[] = [];
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
              minute: row.minute as number | null,
              minute_extra: row.minute_extra as number | null,
              team_id: row.team_id as number | null,
            });
            ex.player_name = row.player_name as string;
          }
          continue;
        }
        goalByStable.set(k, { id: 0, player_name: (row.player_name as string) ?? null });
        toInsert.push(row);
      } else {
        if (nonGoalDup(type, row.minute, row.player_name, row.team_id)) continue;
        nonGoals.push({
          type,
          minute: row.minute,
          player_name: row.player_name,
          team_id: row.team_id,
        });
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
      if (!ins.error) eventsInserted += toInsert.length;
    }

    // ----- Notifs de BUT : seulement quand le buteur est connu -----
    // On notifie un but UNE seule fois (clé d'idempotence par minute+équipe).
    // Cas couverts : but inséré avec buteur, buteur arrivé après coup (update),
    // et garde-fou pour un but resté sans buteur d'un cycle à l'autre.
    type GoalNotif = {
      minute: number | null;
      minute_extra: number | null;
      team_id: number | null;
      player_name: string | null;
    };
    const goalsToNotify: GoalNotif[] = [];

    // 1) buts fraîchement insérés AVEC le buteur
    for (const e of toInsert) {
      if (isGoal(e.type as string) && e.player_name) {
        goalsToNotify.push({
          minute: e.minute as number | null,
          minute_extra: e.minute_extra as number | null,
          team_id: e.team_id as number | null,
          player_name: e.player_name as string,
        });
      }
    }
    // 2) buts dont le buteur vient d'être complété
    for (const u of toUpdate) {
      goalsToNotify.push({
        minute: u.minute,
        minute_extra: u.minute_extra,
        team_id: u.team_id,
        player_name: u.player_name,
      });
    }
    // 3) garde-fou : but déjà en base, toujours sans buteur, non complété ce cycle
    const enrichedIds = new Set(toUpdate.map((u) => u.id));
    for (const e of existing ?? []) {
      if (isGoal(e.type as string) && !e.player_name && !enrichedIds.has(e.id as number)) {
        goalsToNotify.push({
          minute: e.minute as number | null,
          minute_extra: e.minute_extra as number | null,
          team_id: e.team_id as number | null,
          player_name: null,
        });
      }
    }

    for (const g of goalsToNotify) {
      const key = `goal-${matchId}-${g.minute ?? "?"}-${g.minute_extra ?? 0}-${g.team_id ?? "x"}`;
      const log = await supabase
        .from("notifications_log")
        .insert({ event_key: key, kind: "live_but" });
      if (log.error) continue; // déjà notifié
      const facts = {
        equipeA: teamName.get(f.teams.home?.id) ?? f.teams.home?.name,
        equipeB: teamName.get(f.teams.away?.id) ?? f.teams.away?.name,
        equipeButeur: g.team_id != null ? teamNameById.get(g.team_id) ?? null : null,
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
              tag: key,
            }),
          });
        }
      } catch (_e) {
        // une notif ratée n'interrompt pas la synchro
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
