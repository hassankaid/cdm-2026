"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = {
  id: number;
  user_id: string | null;
  content: string | null;
  type: string;
  created_at: string;
  match_id?: number | null;
};

function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

export function ChatRoom({
  initial,
  names,
  myUserId,
  tz,
  matchId = null,
}: {
  initial: Msg[];
  names: Record<string, string>;
  myUserId: string;
  tz: string;
  matchId?: number | null;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as Msg;
          if ((m.match_id ?? null) !== matchId) return; // garder la bonne conversation
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function send() {
    const c = text.trim();
    if (!c || sending) return;
    setSending(true);
    setText("");
    const { error } = await createClient()
      .from("chat_messages")
      .insert({ user_id: myUserId, content: c, type: "user", match_id: matchId });
    if (error) setText(c);
    setSending(false);
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-40 pt-4">
        {msgs.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            Lance la causerie ! 💬
          </p>
        )}
        {msgs.map((m) => {
          if (m.type === "system") {
            return (
              <div key={m.id} className="my-1 text-center">
                <span className="inline-block rounded-full bg-volt/10 px-3 py-1 text-xs font-semibold text-volt">
                  {m.content}
                </span>
              </div>
            );
          }
          const mine = m.user_id === myUserId;
          const author = (m.user_id && names[m.user_id]) || "Joueur";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <span className="mb-0.5 ml-1 text-[11px] font-semibold text-muted">{author}</span>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-volt text-pitch-950" : "bg-pitch-800 text-ink"
                }`}
              >
                {m.content}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-muted/60">
                {timeLabel(m.created_at, tz)}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Barre de saisie (au-dessus de la nav) */}
      <div className="fixed inset-x-0 bottom-[60px] z-40 mx-auto max-w-lg border-t border-line/60 bg-pitch-950/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            maxLength={500}
            placeholder="Écris un message…"
            className="field flex-1"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="btn-volt shrink-0 px-4 py-2.5 disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
