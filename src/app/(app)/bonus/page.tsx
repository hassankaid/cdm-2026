import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BonusForm } from "@/components/bonus-form";

export default async function BonusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, name_fr, logo_url")
    .order("name_fr", { ascending: true });
  const teams = (teamsData ?? []).map((t) => ({
    id: t.id,
    name: t.name_fr ?? t.name,
    logo: t.logo_url,
  }));

  const { data: bonuses } = await supabase
    .from("tournament_bonuses")
    .select("key, label, value_kind, points, locked_at")
    .order("points", { ascending: false });

  const { data: bp } = await supabase
    .from("bonus_predictions")
    .select("bonus_key, value")
    .eq("user_id", user.id);
  const picks: Record<string, string> = {};
  for (const x of bp ?? []) picks[x.bonus_key] = x.value;

  const lockedAt = bonuses?.[0]?.locked_at as string | undefined;
  const locked = lockedAt ? new Date(lockedAt).getTime() <= Date.now() : false;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Accueil
        </Link>
        <div className="font-display text-lg leading-none">
          BONUS <span className="text-gold">TOURNOI</span>
        </div>
        <div className="w-14" />
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">
        <p className="rise mb-4 text-sm text-muted">
          Place tes paris longue durée. Ils rapportent gros et se résolvent en fin de tournoi.
          {locked ? (
            <span className="mt-2 block font-semibold text-coral">
              🔒 Verrouillé — les bonus sont figés depuis le coup d&apos;envoi du 1er match.
            </span>
          ) : (
            <span className="mt-2 block font-semibold text-gold">
              ⏳ À choisir avant le coup d&apos;envoi du 1er match — après, c&apos;est verrouillé !
            </span>
          )}
        </p>

        <div className="rise" style={{ animationDelay: "0.05s" }}>
          <BonusForm
            userId={user.id}
            teams={teams}
            bonuses={(bonuses ?? []) as never}
            picks={picks}
            locked={locked}
          />
        </div>
      </main>
    </div>
  );
}
