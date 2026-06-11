import { type ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      {/* Halo lumineux */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-volt/20 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Marque */}
        <div className="rise mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-pitch-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-volt" />
            Coupe du Monde 2026
          </div>
          <h1 className="font-display text-6xl leading-[0.85] text-ink">
            MONDIAL <span className="text-volt">26</span>
          </h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.25em] text-muted">
            Pronos entre potes
          </p>
        </div>

        {/* Carte */}
        <div
          className="rise rounded-3xl border border-line bg-pitch-900/60 p-6 shadow-2xl backdrop-blur"
          style={{ animationDelay: "0.05s" }}
        >
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>

        <p
          className="rise mt-6 text-center text-xs text-muted/70"
          style={{ animationDelay: "0.3s" }}
        >
          11 juin → 19 juillet 2026 · 48 nations · 104 matchs
        </p>
      </div>
    </main>
  );
}
