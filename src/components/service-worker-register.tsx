"use client";

import { useEffect } from "react";

// Enregistre le service worker (notifications push + installation PWA).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
