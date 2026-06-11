"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="rounded-full border border-line bg-pitch-900/60 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-coral/50 hover:text-coral"
    >
      {loading ? "..." : "Déconnexion"}
    </button>
  );
}
