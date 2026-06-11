"use client";

import { useState } from "react";

type Row = {
  user_id: string;
  display_name: string;
  total_live: number;
  total_official: number;
  live_hits: number;
};

export function LeaderboardView({ rows, myId }: { rows: Row[]; myId: string }) {
  const [mode, setMode] = useState<"officiel" | "live">("officiel");

  const sorted = [...rows].sort((a, b) =>
    mode === "live"
      ? b.total_live - a.total_live
      : b.total_official - a.total_official,
  );

  return (
    <div>
      {/* Bascule */}
      <div className="mb-4 flex rounded-full border border-line bg-pitch-900/60 p-1">
        {(["officiel", "live"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-volt text-pitch-950" : "text-muted"
            }`}
          >
            {m === "officiel" ? "Officiel" : "🔴 Live"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-pitch-900/40">
        {sorted.map((p, i) => {
          const isMe = p.user_id === myId;
          const pts = mode === "live" ? p.total_live : p.total_official;
          const rankColor =
            i === 0 ? "text-gold" : i === 1 ? "text-ink" : i === 2 ? "text-coral" : "text-muted";
          return (
            <div
              key={p.user_id}
              className={`flex items-center gap-3 border-b border-line/50 px-4 py-3 last:border-0 ${
                isMe ? "bg-volt/5" : ""
              }`}
            >
              <span className={`w-6 text-center font-display text-lg ${rankColor}`}>{i + 1}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pitch-800 text-sm font-bold text-ink">
                {(p.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 truncate text-sm font-semibold text-ink">
                {p.display_name}
                {isMe && <span className="ml-1 text-volt">· toi</span>}
              </span>
              {mode === "live" && p.live_hits > 0 && (
                <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-bold text-coral">
                  {p.live_hits} live
                </span>
              )}
              <span className="font-display text-lg tabular-nums text-ink">
                {pts}
                <span className="ml-1 font-sans text-xs text-muted">pts</span>
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">Classement vide pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
