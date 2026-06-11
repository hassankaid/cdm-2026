"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

const MAX_S = 20;
type Phase = "idle" | "preview" | "uploading";

export function RecordReact({ userId, matchId }: { userId: string; matchId: number | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const durRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  function pick() {
    setError(null);
    inputRef.current?.click();
  }

  function readDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve(v.duration);
      v.onerror = () => resolve(0);
      v.src = url;
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const dur = await readDuration(url);
    if (Number.isFinite(dur) && dur > MAX_S + 2) {
      URL.revokeObjectURL(url);
      setError(`Vidéo trop longue (${Math.round(dur)} s). Garde-la sous ${MAX_S} s 🙏`);
      return;
    }
    durRef.current = Number.isFinite(dur) && dur > 0 ? Math.min(MAX_S, Math.round(dur)) : MAX_S;
    fileRef.current = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setPhase("preview");
  }

  async function send() {
    if (!fileRef.current) return;
    setPhase("uploading");
    try {
      const supabase = createClient();
      const { data, error: fnErr } = await supabase.functions.invoke("create-react", { body: {} });
      if (fnErr || !data?.guid) throw new Error("create");
      await new Promise<void>((resolve, reject) => {
        const up = new tus.Upload(fileRef.current!, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: data.signature,
            AuthorizationExpire: String(data.expire),
            VideoId: data.guid,
            LibraryId: String(data.libraryId),
          },
          metadata: { filetype: fileRef.current!.type || "video/mp4", title: "react" },
          onError: () => reject(new Error("tus")),
          onSuccess: () => resolve(),
        });
        up.start();
      });
      const cdn = process.env.NEXT_PUBLIC_BUNNY_CDN;
      await supabase.from("chat_messages").insert({
        user_id: userId,
        match_id: matchId,
        type: "user",
        media_type: "video",
        media_url: data.guid,
        thumbnail_url: `https://${cdn}/${data.guid}/thumbnail.jpg`,
        duration: durRef.current,
      });
      cleanup();
    } catch {
      setError("Échec de l'envoi. Réessaie.");
      setPhase("preview");
    }
  }

  function cleanup() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    fileRef.current = null;
    setPhase("idle");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="user"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={pick}
        aria-label="Envoyer un react vidéo"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-pitch-800 text-lg transition-colors hover:border-volt/60"
      >
        🎥
      </button>

      {error && (
        <div className="fixed left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full border border-coral/40 bg-pitch-900 px-4 py-1.5 text-center text-xs font-semibold text-coral shadow-lg">
          {error}
        </div>
      )}

      {phase !== "idle" && previewUrl && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-pitch-950">
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={cleanup} className="text-sm font-semibold text-muted">
              Fermer
            </button>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Ton react
            </span>
            <span className="w-12" />
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video
              src={previewUrl}
              controls
              autoPlay
              loop
              playsInline
              className="h-full w-full object-contain"
            />
            {phase === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-pitch-950/70">
                <span className="text-3xl">🎬</span>
                <span className="text-sm font-semibold text-volt">Envoi en cours…</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 px-6 py-6">
            <button
              onClick={pick}
              disabled={phase === "uploading"}
              className="rounded-full border border-line bg-pitch-800 px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Refaire
            </button>
            <button
              onClick={send}
              disabled={phase === "uploading"}
              className="btn-volt px-6 py-3 disabled:opacity-50"
            >
              {phase === "uploading" ? "Envoi…" : "Envoyer 🚀"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
