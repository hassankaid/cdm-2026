"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ZONES: [string, string][] = [
  ["Europe/Paris", "Paris / France"],
  ["Europe/London", "Londres"],
  ["Europe/Brussels", "Bruxelles"],
  ["Africa/Casablanca", "Casablanca"],
  ["Africa/Algiers", "Alger / Tunis"],
  ["America/Montreal", "Montréal / Toronto"],
  ["America/New_York", "New York"],
  ["America/Mexico_City", "Mexico"],
  ["America/Los_Angeles", "Los Angeles"],
  ["America/Sao_Paulo", "São Paulo"],
  ["Asia/Dubai", "Dubaï"],
  ["Asia/Riyadh", "Riyad / La Mecque"],
  ["Asia/Tokyo", "Tokyo"],
];

export function TimezoneSelect({ userId, current }: { userId: string; current: string }) {
  const router = useRouter();
  const [tz, setTz] = useState(current);
  const [saving, setSaving] = useState(false);

  async function onChange(v: string) {
    setTz(v);
    setSaving(true);
    await createClient().from("profiles").update({ timezone: v }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        Fuseau horaire {saving && <span className="text-volt">· enregistré</span>}
      </label>
      <select value={tz} onChange={(e) => onChange(e.target.value)} className="field">
        {ZONES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
