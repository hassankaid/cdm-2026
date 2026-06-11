import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationToggle } from "@/components/notification-toggle";
import { TimezoneSelect } from "@/components/timezone-select";

type Team = { id: number; name: string; name_fr: string | null; logo_url: string | null };

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-pitch-900/40 p-4 text-center">
      <div className="font-display text-3xl text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}

function TeamLine({ team }: { team: Team | undefined }) {
  if (!team) return <span className="text-sm text-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      {team.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-line" />
      ) : null}
      <span className="text-sm font-semibold text-ink">{team.name_fr ?? team.name}</span>
    </span>
  );
}

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", user.id)
    .single();

  const { data: stats } = await supabase
    .from("player_stats")
    .select("graded, hits, exacts, total_points, current_streak, best_streak, success_rate")
    .eq("user_id", user.id)
    .single();

  const { data: board } = await supabase
    .from("leaderboard_live")
    .select("user_id")
    .order("total_official", { ascending: false });
  const rank = (board ?? []).findIndex((r) => r.user_id === user.id) + 1;

  const { data: aff } = await supabase
    .from("player_team_affinity")
    .select("team_id, n, avg_pts")
    .eq("user_id", user.id)
    .gte("n", 2)
    .order("avg_pts", { ascending: false });

  const teamMap = new Map<number, Team>();
  if (aff && aff.length > 0) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, name_fr, logo_url")
      .in("id", aff.map((a) => a.team_id as number));
    for (const t of teams ?? []) teamMap.set(t.id, t as Team);
  }
  const fetiche = aff && aff.length > 0 ? teamMap.get(aff[0].team_id as number) : undefined;
  const bete = aff && aff.length > 0 ? teamMap.get(aff[aff.length - 1].team_id as number) : undefined;

  const { data: allBadges } = await supabase
    .from("badges")
    .select("code, label_fr, description_fr, icon");
  const { data: mine } = await supabase
    .from("user_badges")
    .select("badge_code")
    .eq("user_id", user.id);
  const earned = new Set((mine ?? []).map((b) => b.badge_code));

  const name = profile?.display_name ?? "Champion";
  const tz = profile?.timezone ?? "Europe/Paris";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Accueil
        </Link>
        <div className="font-display text-lg leading-none">
          MON <span className="text-volt">PROFIL</span>
        </div>
        <div className="w-14" />
      </header>

      <main className="flex-1 px-4 pb-28 pt-6">
        {/* En-tête joueur */}
        <section className="rise flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-volt text-2xl font-bold text-pitch-950">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-3xl leading-none text-ink">{name}</h1>
            <p className="mt-1 text-sm text-muted">
              {rank > 0 ? `${rank}ᵉ au classement` : "Pas encore classé"}
            </p>
          </div>
        </section>

        {/* Tuiles stats */}
        <section className="rise mt-6 grid grid-cols-2 gap-3" style={{ animationDelay: "0.05s" }}>
          <Tile value={stats?.total_points ?? 0} label="Points" />
          <Tile value={`${stats?.success_rate ?? 0}%`} label="Réussite" />
          <Tile value={stats?.current_streak ?? 0} label="Série en cours 🔥" />
          <Tile value={stats?.exacts ?? 0} label="Scores exacts" />
        </section>

        {/* Fétiche / bête noire */}
        <section className="rise mt-6" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-ink">
            Tes équipes
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-2xl border border-line bg-pitch-900/40 px-4 py-3">
              <span className="text-sm text-muted">⭐ Équipe fétiche</span>
              <TeamLine team={fetiche} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-line bg-pitch-900/40 px-4 py-3">
              <span className="text-sm text-muted">😤 Bête noire</span>
              <TeamLine team={bete} />
            </div>
          </div>
          {(!aff || aff.length === 0) && (
            <p className="mt-2 text-center text-xs text-muted/70">
              Disponible après quelques matchs pronostiqués.
            </p>
          )}
        </section>

        {/* Palmarès */}
        <section className="rise mt-8" style={{ animationDelay: "0.12s" }}>
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-ink">
            Palmarès
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {(allBadges ?? []).map((b) => {
              const has = earned.has(b.code);
              return (
                <div
                  key={b.code}
                  title={b.description_fr ?? ""}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center ${
                    has
                      ? "border-volt/40 bg-volt/5"
                      : "border-line bg-pitch-900/30 opacity-40 grayscale"
                  }`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-[9px] font-semibold leading-tight text-ink">
                    {b.label_fr}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Réglages */}
        <section className="rise mt-8" style={{ animationDelay: "0.15s" }}>
          <h2 className="mb-3 font-display text-base uppercase tracking-wide text-ink">Réglages</h2>
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-pitch-900/40 p-4">
            <TimezoneSelect userId={user.id} current={tz} />
            <NotificationToggle userId={user.id} />
            <div className="pt-1">
              <SignOutButton />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
