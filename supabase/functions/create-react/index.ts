// =====================================================================
// create-react — crée un objet vidéo chez Bunny Stream et renvoie une
// autorisation d'upload TUS signée (le téléphone upload ensuite en direct).
// Appelée par un utilisateur connecté (JWT Supabase vérifié manuellement).
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  // Authentifier l'utilisateur via son JWT
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

  const apiKey = Deno.env.get("BUNNY_API_KEY")!;
  const libraryId = Deno.env.get("BUNNY_LIBRARY_ID")!;
  const cdn = Deno.env.get("BUNNY_CDN")!;

  // 1) Créer l'objet vidéo chez Bunny
  const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: "POST",
    headers: { AccessKey: apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ title: `react-${user.id.slice(0, 8)}-${Date.now()}` }),
  });
  const video = await createRes.json().catch(() => ({}));
  const guid = video?.guid;
  if (!guid) return json({ error: "bunny_create_failed", detail: video }, 502);

  // 2) Signature TUS : sha256(libraryId + apiKey + expire + guid)
  const expire = Math.floor(Date.now() / 1000) + 3600;
  const buf = new TextEncoder().encode(`${libraryId}${apiKey}${expire}${guid}`);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const signature = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return json({ guid, libraryId, signature, expire, cdn });
});
