import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationToggle } from "@/components/notification-toggle";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: board } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .limit(10);

  const name = profile?.display_name ?? "Champion";
  const initial = name.charAt(0).toUpperCase();
  const players = board ?? [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      {/* Barre du haut */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3 backdrop-blur">
        <div className="font-display text-xl leading-none">
          MONDIAL <span className="text-volt">26</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profil"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-volt text-sm font-bold text-pitch-950"
          >
            {initial}
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-5 pb-24 pt-6">
        {/* Accueil */}
        <section className="rise">
          <p className="text-sm text-muted">Salut 👋</p>
          <h1 className="font-display text-4xl text-ink">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            La Coupe du Monde commence. Place tes pronos et grimpe au classement.
          </p>
        </section>

        {/* Notifications */}
        <section className="rise mt-6" style={{ animationDelay: "0.03s" }}>
          <NotificationToggle userId={user.id} />
        </section>

        {/* Bonus tournoi */}
        <section className="rise mt-6" style={{ animationDelay: "0.04s" }}>
          <Link
            href="/bonus"
            className="group flex items-center justify-between rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-pitch-900/60 p-5 transition-colors hover:border-gold/60"
          >
            <div>
              <p className="text-sm font-semibold text-ink">🏆 Bonus tournoi</p>
              <p className="mt-1 text-xs text-muted">
                Vainqueur, meilleur buteur, meilleur joueur… À choisir avant ce soir !
              </p>
            </div>
            <span className="font-display text-2xl text-gold transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </section>

        {/* Matchs du jour */}
        <section className="rise mt-8" style={{ animationDelay: "0.05s" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-wide text-ink">
              MATCHS DU JOUR
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Aujourd&apos;hui
            </span>
          </div>

          <Link
            href="/matchs"
            className="group flex items-center justify-between rounded-2xl border border-line bg-gradient-to-br from-pitch-800/70 to-pitch-900/60 p-5 transition-colors hover:border-volt/50"
          >
            <div>
              <p className="text-sm font-semibold text-ink">
                Place tes pronostics ⚽
              </p>
              <p className="mt-1 text-xs text-muted">
                Les 72 matchs de poule sont ouverts. Pronostique jusqu&apos;au coup
                d&apos;envoi.
              </p>
            </div>
            <span className="font-display text-2xl text-volt transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </section>

        {/* Classement */}
        <section className="rise mt-8" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 font-display text-lg tracking-wide text-ink">
            CLASSEMENT
          </h2>

          <div className="overflow-hidden rounded-2xl border border-line bg-pitch-900/40">
            {players.map((p, i) => {
              const isMe = p.user_id === user.id;
              const rankColor =
                i === 0 ? "text-gold" : i === 1 ? "text-ink" : "text-muted";
              return (
                <div
                  key={p.user_id ?? i}
                  className={`flex items-center gap-3 border-b border-line/50 px-4 py-3 last:border-0 ${
                    isMe ? "bg-volt/5" : ""
                  }`}
                >
                  <span
                    className={`w-6 text-center font-display text-lg ${rankColor}`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pitch-800 text-sm font-bold text-ink">
                    {(p.display_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-sm font-semibold text-ink">
                    {p.display_name}
                    {isMe && <span className="ml-1 text-volt">· toi</span>}
                  </span>
                  <span className="font-display text-lg text-ink">
                    {p.total_points ?? 0}
                    <span className="ml-1 font-sans text-xs text-muted">pts</span>
                  </span>
                </div>
              );
            })}
            {players.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted">
                Personne au classement pour l&apos;instant.
              </p>
            )}
          </div>
        </section>

        {/* Invitation amis (teaser) */}
        <section className="rise mt-8" style={{ animationDelay: "0.15s" }}>
          <div className="rounded-2xl border border-line bg-gradient-to-br from-pitch-800/60 to-pitch-900/60 p-5">
            <h3 className="font-display text-lg text-ink">INVITE TES POTES</h3>
            <p className="mt-1 text-sm text-muted">
              Le jeu est bien plus fun à plusieurs. Le lien d&apos;invitation
              arrive dans une prochaine mise à jour.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
