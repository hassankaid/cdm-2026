"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

const MAX_MS = 20000;
type Phase = "closed" | "init" | "ready" | "recording" | "preview" | "uploading";

export function RecordReact({ userId, matchId }: { userId: string; matchId: number | null }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const previewUrl = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const durRef = useRef(0);

  // Connecte le flux à l'élément vidéo APRÈS le rendu (fiable sur mobile)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if ((phase === "ready" || phase === "recording") && streamRef.current) {
      v.srcObject = streamRef.current;
      v.removeAttribute("src");
      v.muted = true;
      v.loop = false;
      v.play().catch(() => {});
    } else if (phase === "preview" && previewUrl.current) {
      v.srcObject = null;
      v.src = previewUrl.current;
      v.muted = false;
      v.loop = true;
      v.play().catch(() => {});
    }
  }, [phase]);

  const open = useCallback(async () => {
    setError(null);
    setPhase("init");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setPhase("ready");
    } catch {
      setError("Caméra/micro non autorisés. Vérifie les réglages du téléphone.");
      setPhase("closed");
    }
  }, []);

  function start() {
    if (phase !== "ready" || !streamRef.current) return;
    chunks.current = [];
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      const b = new Blob(chunks.current, { type: mime });
      blob.current = b;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(b);
      setPhase("preview");
    };
    recRef.current = rec;
    rec.start();
    setPhase("recording");
    setPct(0);
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const e = Date.now() - t0;
      durRef.current = e;
      setPct(Math.min(100, (e / MAX_MS) * 100));
      if (e >= MAX_MS) stop();
    }, 80);
  }

  function stop() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  async function send() {
    if (!blob.current) return;
    setPhase("uploading");
    try {
      const supabase = createClient();
      const { data, error: fnErr } = await supabase.functions.invoke("create-react", { body: {} });
      if (fnErr || !data?.guid) throw new Error("create");
      await new Promise<void>((resolve, reject) => {
        const up = new tus.Upload(blob.current!, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: data.signature,
            AuthorizationExpire: String(data.expire),
            VideoId: data.guid,
            LibraryId: String(data.libraryId),
          },
          metadata: { filetype: blob.current!.type || "video/webm", title: "react" },
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
        duration: Math.round(durRef.current / 1000),
      });
      cleanup();
    } catch {
      setError("Échec de l'envoi. Réessaie.");
      setPhase("preview");
    }
  }

  function cleanup() {
    if (timer.current) clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    blob.current = null;
    chunks.current = [];
    setPct(0);
    setPhase("closed");
  }

  function retake() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    blob.current = null;
    chunks.current = [];
    setPhase("ready");
  }

  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Envoyer un react vidéo"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-pitch-800 text-lg transition-colors hover:border-volt/60"
      >
        🎥
      </button>

      {error && phase === "closed" && (
        <div className="fixed left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full border border-coral/40 bg-pitch-900 px-4 py-1.5 text-center text-xs font-semibold text-coral shadow-lg">
          {error}
        </div>
      )}

      {phase !== "closed" && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-pitch-950">
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={cleanup} className="text-sm font-semibold text-muted">
              Fermer
            </button>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              React · 20 s max
            </span>
            <span className="w-12" />
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${phase === "preview" ? "" : "-scale-x-100"}`}
            />
            {phase === "init" && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Ouverture de la caméra…
              </div>
            )}
            {phase === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-pitch-950/70">
                <span className="text-3xl">🎬</span>
                <span className="text-sm font-semibold text-volt">Envoi en cours…</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 px-6 py-6">
            {(phase === "ready" || phase === "recording") && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onPointerDown={start}
                  onPointerUp={stop}
                  onPointerLeave={stop}
                  onPointerCancel={stop}
                  className="relative flex h-20 w-20 touch-none select-none items-center justify-center"
                >
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={R} fill="none" stroke="#18352a" strokeWidth="5" />
                    <circle
                      cx="40"
                      cy="40"
                      r={R}
                      fill="none"
                      stroke="#ff5a5f"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - pct / 100)}
                    />
                  </svg>
                  <span
                    className={`bg-coral transition-all ${
                      phase === "recording" ? "h-7 w-7 rounded-md" : "h-14 w-14 rounded-full"
                    }`}
                  />
                </button>
                <span className="text-xs text-muted">
                  {phase === "recording" ? "Relâche pour arrêter" : "Maintiens pour filmer"}
                </span>
              </div>
            )}

            {phase === "preview" && (
              <>
                <button
                  onClick={retake}
                  className="rounded-full border border-line bg-pitch-800 px-5 py-3 text-sm font-semibold text-ink"
                >
                  Refaire
                </button>
                <button onClick={send} className="btn-volt px-6 py-3">
                  Envoyer 🚀
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
