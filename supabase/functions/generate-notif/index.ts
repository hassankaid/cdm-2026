// =====================================================================
// generate-notif — génère une notification fun via OpenRouter (Claude),
// avec garde-fou de modération (ton bon enfant, valeurs respectées).
// Sécurité : header x-sync-secret == SYNC_SECRET.
// =====================================================================
const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM = `Tu écris des notifications pour "Mondial 26", une app de pronostics de la Coupe du Monde 2026 entre amis (en français).
Ton : "street" (rebeu/renois), taquin, complice, DRÔLE et PIQUANT — mais 100% BON ENFANT.
RÈGLES ABSOLUES (valeurs musulmanes) : aucun gros mot, aucune vulgarité, rien de borderline, pas d'alcool, pas de référence à s'incliner/à l'idolâtrie, pas d'humiliation dégradante, aucun sous-entendu déplacé.
Contraintes : UNE seule notification, courte (max ~140 caractères), percutante, avec souvent un emoji bien placé. Varie le style à chaque fois (effet surprise). Appuie-toi sur les faits réels fournis.
Réponds UNIQUEMENT par le texte de la notification (sans guillemets, sans explication).`;

const OBJECTIFS: Record<string, string> = {
  clown:
    "Charrie gentiment le pire pronostiqueur du moment (le 'clown du soir' / 'le plus claqué'). Taquin, jamais méchant ni humiliant.",
  boss: "Félicite le meilleur pronostiqueur du moment (le 'boss du jour'). Donne-lui de l'ego, sans idolâtrie.",
  live_tient:
    "Suspense : le prono d'un joueur est en train de passer en plein match. Donne envie que ça tienne jusqu'au bout.",
  live_but: "Réagis à chaud à un événement du match (but, égalisation, retournement).",
  tacle: "Mets en avant ou charrie gentiment un joueur précis.",
  top3: "Annonce le top 3 actuel du classement avec du piquant.",
  recap: "Résume avec humour les résultats et le classement du jour (2-3 phrases max).",
  fin_match: "Annonce la fin du match avec le score final et un clin d'œil taquin (à ceux qui avaient bon… ou pas).",
  rappel_match: "Rappelle de poser son prono avant le coup d'envoi, avec entrain.",
  rappel_absent: "Préviens qu'un joueur n'a pas encore mis son prono et que le match approche.",
  serie: "Célèbre une série de bons pronos d'affilée.",
};

const BANNED: RegExp[] = [
  /\bputain\b/i, /\bmerde\b/i, /\bencul/i, /\bniqu/i, /\bb[aâ]tard\b/i,
  /\bsalope\b/i, /\bpute\b/i, /\bconnard\b/i, /\bconnasse\b/i, /\bpd\b/i,
];

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { type, facts, recent } = await req.json().catch(() => ({}));
  const objectif = OBJECTIFS[type] ?? "Écris une notification fun et piquante pour l'app.";
  const key = Deno.env.get("OPENROUTER_API_KEY")!;
  const model = type === "recap" ? "anthropic/claude-sonnet-4.6" : "anthropic/claude-haiku-4.5";

  const userMsg =
    `Type : ${type}\nObjectif : ${objectif}\nFaits réels (à utiliser) : ${JSON.stringify(facts ?? {})}` +
    (Array.isArray(recent) && recent.length
      ? `\nN'utilise AUCUNE de ces formulations déjà envoyées récemment : ${JSON.stringify(recent)}`
      : "");

  async function gen(extra = ""): Promise<string> {
    const r = await fetch(OPENROUTER, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Mondial 26",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM + extra },
          { role: "user", content: userMsg },
        ],
        temperature: 1.0,
        max_tokens: 160,
      }),
    });
    const j = await r.json();
    return (j.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["«“”]+|["»“”]+$/g, "")
      .trim();
  }

  let text = await gen();
  if (!text || BANNED.some((re) => re.test(text))) {
    // Modération : on régénère une fois en insistant sur le ton propre
    text = await gen("\nIMPORTANT : reste strictement poli et bon enfant, zéro mot vulgaire.");
  }
  const clean = !text || BANNED.some((re) => re.test(text)) ? "" : text;

  return new Response(JSON.stringify({ text: clean, model }), {
    headers: { "Content-Type": "application/json" },
  });
});
