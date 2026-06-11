import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "@/components/chat-room";

export default async function ChatPage() {
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

  const { data: msgs } = await supabase
    .from("chat_messages")
    .select("id, user_id, content, type, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const initial = (msgs ?? []).slice().reverse();

  const { data: profiles } = await supabase.from("profiles").select("id, display_name");
  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.display_name;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-center border-b border-line/60 bg-pitch-950/80 px-5 py-3.5 backdrop-blur">
        <div className="font-display text-lg leading-none">
          LE <span className="text-volt">VESTIAIRE</span>
        </div>
      </header>

      <ChatRoom initial={initial} names={names} myUserId={user.id} tz={tz} />
    </div>
  );
}
