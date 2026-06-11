"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/matchs", label: "Matchs", icon: "📅" },
  { href: "/live", label: "Live", icon: "🔴" },
  { href: "/classement", label: "Classement", icon: "🏆" },
  { href: "/chat", label: "Chat", icon: "💬" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line/60 bg-pitch-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <span className={`text-lg leading-none ${active ? "" : "opacity-40 grayscale"}`}>
                {t.icon}
              </span>
              <span
                className={`text-[10px] font-semibold ${active ? "text-volt" : "text-muted"}`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
