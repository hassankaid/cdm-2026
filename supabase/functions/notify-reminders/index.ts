// =====================================================================
// notify-reminders — rappel ~30 min avant un match aux joueurs qui n'ont
// pas encore posé leur prono. Appelée par cron toutes les ~5 min.
// Idempotent via notifications_log (un rappel par match).
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

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

  const now = Date.now();
  const fromIso = new Date(now + 25 * 60 * 1000).toISOString();
  const toIso = new Date(now + 40 * 60 * 1000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select(`id, kickoff, home:home_team_id ( name, name_fr ), away:away_team_id ( name, name_fr )`)
    .eq("status", "scheduled")
    .gte("kickoff", fromIso)
    .lte("kickoff", toIso);

  let reminded = 0;
  for (const m of matches ?? []) {
    // Idempotence : on ne rappelle qu'une fois par match
    const logIns = await supabase
      .from("notifications_log")
      .insert({ event_key: `remind-${m.id}`, kind: "rappel" });
    if (logIns.error) continue;

    // Joueurs sans prono sur ce match
    const { data: allUsers } = await supabase.from("profiles").select("id");
    const { data: predicted } = await supabase
      .from("predictions")
      .select("user_id")
      .eq("match_id", m.id);
    const predSet = new Set((predicted ?? []).map((p) => p.user_id));
    const absent = (allUsers ?? []).map((u) => u.id).filter((id) => !predSet.has(id));
    if (absent.length === 0) continue;

    // deno-lint-ignore no-explicit-any
    const h = m.home as any;
    // deno-lint-ignore no-explicit-any
    const a = m.away as any;
    const facts = {
      match: `${h?.name_fr ?? h?.name}-${a?.name_fr ?? a?.name}`,
      minute: "30 min",
    };

    try {
      const gen = await fetch(`${SUPA_URL}/functions/v1/generate-notif`, {
        method: "POST",
        headers: fnHeaders,
        body: JSON.stringify({ type: "rappel_absent", facts }),
      }).then((r) => r.json());
      if (gen?.text) {
        await fetch(`${SUPA_URL}/functions/v1/send-push`, {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({
            user_ids: absent,
            title: "⏰ Ton prono ?",
            body: gen.text,
            url: "/matchs",
            tag: `remind-${m.id}`,
          }),
        });
        reminded++;
      }
    } catch (_e) {
      // on continue avec les autres matchs
    }
  }

  return new Response(
    JSON.stringify({ ok: true, matches: matches?.length ?? 0, reminded }),
    { headers: { "Content-Type": "application/json" } },
  );
});
