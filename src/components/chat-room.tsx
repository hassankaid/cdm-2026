"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecordReact } from "./record-react";

type Msg = {
  id: number;
  user_id: string | null;
  content: string | null;
  type: string;
  created_at: string;
  match_id?: number | null;
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
};

function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

function VideoBubble({
  guid,
  thumb,
  duration,
}: {
  guid: string;
  thumb: string | null;
  duration: number | null;
}) {
  const [play, setPlay] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const lib = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID;

  if (play) {
    return (
      <div className="aspect-[9/16] w-52 max-w-[78%] overflow-hidden rounded-2xl border border-line bg-black">
        <iframe
          src={`https://iframe.mediadelivery.net/embed/${lib}/${guid}?autoplay=true&preload=true`}
          loading="lazy"
          className="h-full w-full"
          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen"
        />
      </div>
    );
  }
  return (
    <button
      onClick={() => setPlay(true)}
      className="relative aspect-[9/16] w-52 max-w-[78%] overflow-hidden rounded-2xl border border-line bg-pitch-800"
    >
      {thumb && !thumbErr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setThumbErr(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-2xl">
          🎥
          <span className="text-[10px] font-semibold text-muted">en traitement…</span>
        </div>
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pitch-950/70 text-xl text-volt">
          ▶
        </span>
      </span>
      {duration ? (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-pitch-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
          {duration}s
        </span>
      ) : null}
    </button>
  );
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
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${matchId ?? "global"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as Msg;
          if ((m.match_id ?? null) !== matchId) return;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const oldId = (payload.old as { id?: number }).id;
          if (oldId != null) setMsgs((prev) => prev.filter((x) => x.id !== oldId));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function sendText() {
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

  async function remove(id: number) {
    setMsgs((prev) => prev.filter((x) => x.id !== id)); // optimiste
    await createClient().from("chat_messages").delete().eq("id", id);
  }

  return (
    <>
      <div
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: "calc(140px + env(safe-area-inset-bottom))" }}
      >
        {msgs.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">Lance la causerie ! 💬</p>
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
          const isVideo = m.media_type === "video" && m.media_url;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <span className="mb-0.5 ml-1 text-[11px] font-semibold text-muted">{author}</span>
              )}
              {isVideo ? (
                <VideoBubble
                  guid={m.media_url as string}
                  thumb={m.thumbnail_url ?? null}
                  duration={m.duration ?? null}
                />
              ) : (
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? "bg-volt text-pitch-950" : "bg-pitch-800 text-ink"
                  }`}
                >
                  {m.content}
                </div>
              )}
              <span className="mt-0.5 flex items-center gap-2 px-1">
                <span className="text-[10px] text-muted/60">{timeLabel(m.created_at, tz)}</span>
                {mine && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-[10px] text-muted/60 transition-colors hover:text-coral"
                  >
                    Supprimer
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {pending && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-pitch-800 px-3.5 py-2 text-sm text-muted">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-volt" />
              🎥 Ton react s&apos;envoie…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Barre de saisie (juste au-dessus de la nav, en tenant compte de la zone de sécurité) */}
      <div
        className="fixed inset-x-0 z-50 mx-auto max-w-lg border-t border-line/60 bg-pitch-950/95 px-3 py-2.5 backdrop-blur"
        style={{ bottom: "calc(54px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <RecordReact
            userId={myUserId}
            matchId={matchId}
            onPending={() => setPending(true)}
            onSettled={(ok, msg) => {
              setPending(false);
              if (ok && msg) {
                const m = msg as Msg;
                setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
              }
            }}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendText();
            }}
            maxLength={500}
            placeholder="Écris un message…"
            className="field flex-1"
          />
          <button
            onClick={sendText}
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
