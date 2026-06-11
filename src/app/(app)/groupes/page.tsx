import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Team = { name: string; name_fr: string | null; fifa_code: string | null; logo_url: string | null };
type Row = {
  group_letter: string;
  rank: number;
  played: number;
  gd: number;
  gf: number;
  points: number;
  team: Team | null;
};

export default async function GroupesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("group_standings")
    .select(
      `group_letter, rank, played, gd, gf, points,
       team:team_id ( name, name_fr, fifa_code, logo_url )`,
    )
    .order("group_letter", { ascending: true })
    .order("rank", { ascending: true });
  const rows = (data ?? []) as unknown as Row[];

  // Meilleurs 3es : les 8 meilleurs parmi les 3es de chaque groupe
  const thirds = rows
    .filter((r) => r.rank === 3)
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  const bestThirdGroups = new Set(thirds.slice(0, 8).map((r) => r.group_letter));

  const groups: { letter: string; rows: Row[] }[] = [];
  for (const r of rows) {
    let g = groups.find((x) => x.letter === r.group_letter);
    if (!g) {
      g = { letter: r.group_letter, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <Link href="/matchs" className="text-sm text-muted transition-colors hover:text-ink">
          ← Matchs
        </Link>
        <div className="font-display text-lg leading-none">
          LES <span className="text-volt">GROUPES</span>
        </div>
        <div className="w-14" />
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {groups.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            Les classements s&apos;afficheront dès les premiers matchs joués.
          </p>
        )}

        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.letter}>
              <h2 className="mb-2 font-display text-base uppercase tracking-wide text-ink">
                Groupe {g.letter}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-line bg-pitch-900/40">
                <div className="flex items-center gap-2 border-b border-line/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <span className="w-4" />
                  <span className="w-6" />
                  <span className="flex-1">Équipe</span>
                  <span className="w-7 text-center">J</span>
                  <span className="w-9 text-center">Diff</span>
                  <span className="w-8 text-center">Pts</span>
                </div>
                {g.rows.map((r) => {
                  const qualif = r.rank <= 2;
                  const bestThird = r.rank === 3 && bestThirdGroups.has(r.group_letter);
                  return (
                    <div
                      key={r.team?.fifa_code ?? r.rank}
                      className="flex items-center gap-2 border-b border-line/40 px-3 py-2 last:border-0"
                    >
                      <span
                        className={`w-4 text-center font-display text-sm ${
                          qualif ? "text-volt" : bestThird ? "text-gold" : "text-muted"
                        }`}
                      >
                        {r.rank}
                      </span>
                      {r.team?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.team.logo_url}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover ring-1 ring-line"
                        />
                      ) : (
                        <span className="w-5" />
                      )}
                      <span className="flex-1 truncate text-sm text-ink">
                        {r.team?.name_fr ?? r.team?.name}
                      </span>
                      <span className="w-7 text-center text-sm tabular-nums text-muted">
                        {r.played}
                      </span>
                      <span className="w-9 text-center text-sm tabular-nums text-muted">
                        {r.gd > 0 ? `+${r.gd}` : r.gd}
                      </span>
                      <span className="w-8 text-center font-display text-base tabular-nums text-ink">
                        {r.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {groups.length > 0 && (
          <p className="mt-5 text-center text-[11px] text-muted">
            <span className="text-volt">●</span> qualifié direct (1er/2e) ·{" "}
            <span className="text-gold">●</span> meilleur 3e qualifié
          </p>
        )}
      </main>
    </div>
  );
}
