// =====================================================================
// send-push — envoie une notification Web Push (VAPID) aux abonnés.
// Body : { user_ids?: string[], title, body, url?, tag? }
//   - sans user_ids => envoi à tous les abonnés.
// Sécurité : header x-sync-secret == SYNC_SECRET.
// =====================================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { user_ids, exclude_user_id, title, body, url: targetUrl, tag } =
    await req.json().catch(() => ({}));

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (Array.isArray(user_ids) && user_ids.length > 0) query = query.in("user_id", user_ids);
  if (exclude_user_id) query = query.neq("user_id", exclude_user_id);
  const { data: subs } = await query;

  const payload = JSON.stringify({
    title: title ?? "Mondial 26",
    body: body ?? "",
    url: targetUrl ?? "/",
    tag,
  });

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
