"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = { id: number; name: string; logo: string | null };
type Bonus = { key: string; label: string; value_kind: string; points: number };

export function BonusForm({
  userId,
  teams,
  bonuses,
  picks,
  locked,
}: {
  userId: string;
  teams: Team[];
  bonuses: Bonus[];
  picks: Record<string, string>;
  locked: boolean;
}) {
  const [vals, setVals] = useState<Record<string, string>>(picks);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function save(key: string, value: string) {
    setVals((v) => ({ ...v, [key]: value }));
    if (!value) return;
    const { error } = await createClient()
      .from("bonus_predictions")
      .upsert({ user_id: userId, bonus_key: key, value }, { onConflict: "user_id,bonus_key" });
    if (!error) {
      setSaved((s) => ({ ...s, [key]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 1500);
    }
  }

  const teamName = (id: string) => teams.find((t) => String(t.id) === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-3">
      {bonuses.map((b) => (
        <div key={b.key} className="rounded-2xl border border-line bg-pitch-900/40 p-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{b.label}</span>
            <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
              {b.points} pts
            </span>
          </div>

          {locked ? (
            <div className="rounded-lg border border-line bg-pitch-950 px-3 py-2.5 text-sm">
              {vals[b.key] ? (
                <span className="font-semibold text-ink">
                  {b.value_kind === "team" ? teamName(vals[b.key]) : vals[b.key]}
                </span>
              ) : (
                <span className="text-muted/60">Aucun choix</span>
              )}
            </div>
          ) : b.value_kind === "team" ? (
            <select
              value={vals[b.key] ?? ""}
              onChange={(e) => save(b.key, e.target.value)}
              className="field"
            >
              <option value="">Choisis une équipe…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              defaultValue={vals[b.key] ?? ""}
              onBlur={(e) => save(b.key, e.target.value.trim())}
              placeholder="Nom du joueur (ex. Kylian Mbappé)"
              className="field"
            />
          )}

          {!locked && (
            <span
              className={`mt-1.5 block h-3 text-[10px] font-semibold uppercase tracking-wider text-volt transition-opacity ${
                saved[b.key] ? "opacity-100" : "opacity-0"
              }`}
            >
              Enregistré ✓
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
