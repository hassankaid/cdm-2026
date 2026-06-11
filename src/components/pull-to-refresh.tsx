"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70; // distance à tirer pour déclencher
const MAX = 110; // amplitude max de l'indicateur

// Le conteneur scrollable le plus proche est-il tout en haut ?
function nearestScrollAtTop(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      return node.scrollTop <= 0;
    }
    node = node.parentElement;
  }
  return window.scrollY <= 0;
}

export function PullToRefresh() {
  const [dist, setDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(false);
  const startY = useRef<number | null>(null);
  const distRef = useRef(0);
  const refreshingRef = useRef(false);

  // Petit toast "À jour ✓" après le rechargement
  useEffect(() => {
    if (sessionStorage.getItem("ptr-done")) {
      sessionStorage.removeItem("ptr-done");
      setToast(true);
      const t = setTimeout(() => setToast(false), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startY.current =
        !refreshingRef.current && nearestScrollAtTop(e.target)
          ? e.touches[0].clientY
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        const d = Math.min(MAX, dy * 0.5);
        distRef.current = d;
        setDist(d);
        if (e.cancelable) e.preventDefault();
      }
    };
    const onEnd = () => {
      if (startY.current == null) return;
      if (distRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        sessionStorage.setItem("ptr-done", "1");
        setTimeout(() => location.reload(), 400);
      } else {
        distRef.current = 0;
        setDist(0);
      }
      startY.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const armed = dist >= THRESHOLD || refreshing;
  const show = dist > 0 || refreshing;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
        style={{
          transform: `translateY(${refreshing ? 14 : Math.max(-8, dist - 28)}px)`,
          opacity: show ? 1 : 0,
          transition: startY.current == null ? "transform .25s ease, opacity .25s ease" : "none",
        }}
      >
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-pitch-900 shadow-lg">
          <span
            className={`text-lg leading-none ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing ? undefined : `rotate(${dist * 3}deg)`,
              color: armed ? "var(--color-volt)" : "var(--color-muted)",
            }}
          >
            ↻
          </span>
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-3 z-[70] -translate-x-1/2 rounded-full border border-volt/40 bg-pitch-900 px-4 py-1.5 text-xs font-semibold text-volt shadow-lg">
          À jour ✓
        </div>
      )}
    </>
  );
}
