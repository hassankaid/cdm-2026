"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "idle" | "on" | "loading" | "unsupported" | "denied";

export function NotificationToggle({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState("on");
      })
      .catch(() => {});
  }, []);

  async function enable() {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ),
        });
      }
      const json = sub.toJSON();
      await createClient()
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
          { onConflict: "endpoint" },
        );
      setState("on");
    } catch (_e) {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;

  const label =
    state === "on"
      ? "🔔 Notifications activées"
      : state === "denied"
        ? "🔕 Débloque-les dans les réglages du navigateur"
        : state === "loading"
          ? "Activation…"
          : "🔔 Activer les notifications";

  return (
    <button
      onClick={state === "on" || state === "denied" ? undefined : enable}
      disabled={state === "loading" || state === "on" || state === "denied"}
      className={`w-full rounded-2xl border px-5 py-3.5 text-sm font-semibold transition-colors ${
        state === "on"
          ? "border-volt/40 bg-volt/10 text-volt"
          : state === "denied"
            ? "border-line bg-pitch-900/40 text-muted"
            : "border-line bg-pitch-900/40 text-ink hover:border-volt/50"
      }`}
    >
      {label}
    </button>
  );
}
