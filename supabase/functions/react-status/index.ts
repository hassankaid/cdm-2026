// =====================================================================
// react-status — renvoie le statut de transcodage d'une vidéo Bunny.
// Sert au client à n'afficher le lecteur QUE quand la vidéo est prête.
// status Bunny : 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding,
//                4 Finished (lisible), 5 Error.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { guid } = await req.json().catch(() => ({}));
  if (!guid) return json({ error: "missing_guid" }, 400);

  const apiKey = Deno.env.get("BUNNY_API_KEY")!;
  const lib = Deno.env.get("BUNNY_LIBRARY_ID")!;
  const r = await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${guid}`, {
    headers: { AccessKey: apiKey, accept: "application/json" },
  });
  const v = await r.json().catch(() => ({}));
  return json({ status: v?.status ?? null, progress: v?.encodeProgress ?? 0 });
});
