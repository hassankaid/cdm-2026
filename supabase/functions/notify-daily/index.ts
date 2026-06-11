// =====================================================================
// notify-daily — pour le 1er jour COMPLET (tous matchs finis) pas encore
// traité : calcule boss & clown du jour, envoie résumé + top 3, et met à
// jour les séries (streaks). Idempotent via daily_awards (unique date+kind).
// Appelée par cron (quelques fois par jour).
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
const nameFr = (t: any) => t?.name_fr ?? t?.name ?? "?";

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const fnHeaders = {
    "Content-Type": "application/json",
    "x-sync-secret": Deno.env.get("SYNC_SECRET") ?? "",
  };
  const callGen = (type: string, facts: unknown) =>
    fetch(`${SUPA_URL}/functions/v1/generate-notif`, {
      method: "POST",
      headers: fnHeaders,
      body: JSON.stringify({ type, facts }),
    }).then((r) => r.json()).catch(() => null);
  const push = (title: string, body: string, url = "/", tag?: string) =>
    fetch(`${SUPA_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: fnHeaders,
      body: JSON.stringify({ title, body, url, tag }),
    }).catch(() => {});

  // --- Mise à jour des séries (streaks) à chaque passage ---
  const { data: gp } = await supabase
    .from("predictions")
    .select("user_id, base_points, matches(kickoff)")
    .not("base_points", "is", null);
  const perUser = new Map<string, { k: string; bp: number }[]>();
  for (const r of gp ?? []) {
    // deno-lint-ignore no-explicit-any
    const k = (r as any).matches?.kickoff as string;
    const arr = perUser.get(r.user_id as string) ?? [];
    arr.push({ k, bp: (r.base_points as number) ?? 0 });
    perUser.set(r.user_id as string, arr);
  }
  for (const [uid, arr] of perUser) {
    arr.sort((a, b) => (a.k < b.k ? -1 : 1));
    let best = 0, run = 0;
    for (const x of arr) {
      if (x.bp > 0) { run++; best = Math.max(best, run); } else run = 0;
    }
    let current = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].bp > 0) current++;
      else break;
    }
    await supabase.from("profiles").update({ current_streak: current, best_streak: best }).eq("id", uid);
  }

  // --- Attribution des badges ---
  await supabase.rpc("award_badges");

  // --- Trouver le 1er jour complet non encore traité ---
  const { data: allMatches } = await supabase
    .from("matches")
    .select(
      `id, kickoff, status, home_score_reg, away_score_reg,
       home:home_team_id ( name, name_fr ), away:away_team_id ( name, name_fr )`,
    );
  const byDate = new Map<string, typeof allMatches>();
  for (const m of allMatches ?? []) {
    const d = (m.kickoff as string).slice(0, 10);
    const arr = byDate.get(d) ?? [];
    // deno-lint-ignore no-explicit-any
    (arr as any).push(m);
    byDate.set(d, arr);
  }
  const { data: done } = await supabase.from("daily_awards").select("award_date");
  const doneSet = new Set((done ?? []).map((d) => d.award_date as string));

  let target: string | null = null;
  for (const d of [...byDate.keys()].sort()) {
    if (doneSet.has(d)) continue;
    const ms = byDate.get(d)!;
    const finished = ms.filter((m) => m.status === "finished").length;
    if (finished > 0 && finished === ms.length) { target = d; break; }
  }
  if (!target) {
    return new Response(JSON.stringify({ ok: true, streaks: perUser.size, day: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Boss & clown du jour ---
  const dayMatches = byDate.get(target)!;
  const dayIds = dayMatches.map((m) => m.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, base_points, profiles(display_name)")
    .in("match_id", dayIds)
    .not("base_points", "is", null);

  const sums = new Map<string, number>();
  const names = new Map<string, string>();
  for (const p of preds ?? []) {
    sums.set(p.user_id as string, (sums.get(p.user_id as string) ?? 0) + ((p.base_points as number) ?? 0));
    // deno-lint-ignore no-explicit-any
    names.set(p.user_id as string, (p as any).profiles?.display_name ?? "Joueur");
  }
  const entries = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    // Personne n'a joué ce jour : on marque quand même comme traité.
    await supabase.from("daily_awards").insert({ award_date: target, kind: "boss", user_id: null, points: 0 });
    return new Response(JSON.stringify({ ok: true, day: target, players: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const boss = entries[0];
  const clown = entries[entries.length - 1];

  // Verrou d'idempotence : on insère d'abord le boss
  const lock = await supabase
    .from("daily_awards")
    .insert({ award_date: target, kind: "boss", user_id: boss[0], points: boss[1] });
  if (lock.error) {
    return new Response(JSON.stringify({ ok: true, day: target, already: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  await supabase
    .from("daily_awards")
    .insert({ award_date: target, kind: "clown", user_id: clown[0], points: clown[1] });

  // Top 3 global
  const { data: board } = await supabase
    .from("leaderboard_live")
    .select("display_name, total_official")
    .order("total_official", { ascending: false })
    .limit(3);

  const resultats = dayMatches.map(
    // deno-lint-ignore no-explicit-any
    (m: any) =>
      `${nameFr(m.home)} ${m.home_score_reg ?? "?"}-${m.away_score_reg ?? "?"} ${nameFr(m.away)}`,
  );

  // Notifs
  const bossNotif = await callGen("boss", { nom: names.get(boss[0]), pts: boss[1] });
  if (bossNotif?.text) await push("👑 Boss du jour", bossNotif.text, "/classement", `boss-${target}`);

  if (entries.length >= 2) {
    const clownNotif = await callGen("clown", { nom: names.get(clown[0]), pts: clown[1] });
    if (clownNotif?.text) await push("🤡 Le plus claqué", clownNotif.text, "/classement", `clown-${target}`);
  }

  const recapNotif = await callGen("recap", {
    resultats,
    top3: (board ?? []).map((b) => ({ nom: b.display_name, pts: b.total_official })),
    boss: { nom: names.get(boss[0]), pts: boss[1] },
  });
  if (recapNotif?.text) await push("📋 Le débrief du jour", recapNotif.text, "/classement", `recap-${target}`);

  return new Response(
    JSON.stringify({ ok: true, day: target, players: entries.length, boss: names.get(boss[0]) }),
    { headers: { "Content-Type": "application/json" } },
  );
});
