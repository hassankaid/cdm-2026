"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit les données de la page (composant serveur) à intervalle régulier,
// et quand l'app revient au premier plan — pour les écrans "live".
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}
