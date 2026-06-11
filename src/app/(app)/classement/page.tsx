import { createClient } from "@/lib/supabase/server";
import { LeaderboardView } from "@/components/leaderboard-view";

export default async function ClassementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("leaderboard_live")
    .select("user_id, display_name, total_live, total_official, live_hits")
    .order("total_official", { ascending: false });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-center border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <div className="font-display text-lg leading-none">
          LE <span className="text-volt">CLASSEMENT</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">
        <LeaderboardView
          rows={(rows ?? []) as never}
          myId={user?.id ?? ""}
        />
      </main>
    </div>
  );
}
