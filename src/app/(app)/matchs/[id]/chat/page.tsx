import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "@/components/chat-room";

export default async function MatchChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const tz = profile?.timezone ?? "Europe/Paris";

  const { data: match } = await supabase
    .from("matches")
    .select(`id, home:home_team_id ( name, name_fr ), away:away_team_id ( name, name_fr )`)
    .eq("id", matchId)
    .single();
  if (!match) notFound();
  // deno-lint-ignore no-explicit-any
  const h = match.home as unknown as { name: string; name_fr: string | null } | null;
  const a = match.away as unknown as { name: string; name_fr: string | null } | null;
  const title = `${h?.name_fr ?? h?.name ?? "?"} – ${a?.name_fr ?? a?.name ?? "?"}`;

  const { data: msgs } = await supabase
    .from("chat_messages")
    .select("id, user_id, content, type, created_at, match_id")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(60);
  const initial = (msgs ?? []).slice().reverse();

  const { data: profiles } = await supabase.from("profiles").select("id, display_name");
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.display_name;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line/60 bg-pitch-950/80 px-4 py-3.5 backdrop-blur">
        <Link
          href={`/matchs/${matchId}`}
          className="shrink-0 text-sm text-muted transition-colors hover:text-ink"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-display text-base text-ink">{title}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Discussion du match</div>
        </div>
        <div className="w-4 shrink-0" />
      </header>

      <ChatRoom initial={initial} names={names} myUserId={user.id} tz={tz} matchId={matchId} />
    </div>
  );
}
