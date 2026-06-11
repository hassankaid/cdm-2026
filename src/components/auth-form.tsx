"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit faire au moins 6 caractères.";
  if (m.includes("unable to validate email")) return "Cet email n'est pas valide.";
  if (m.includes("email not confirmed"))
    return "Email non confirmé. Vérifie ta boîte mail.";
  return "Une erreur est survenue. Réessaie.";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(translateError((err as Error).message));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {isSignup && (
        <div className="rise" style={{ animationDelay: "0.05s" }}>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
            Ton pseudo
          </label>
          <input
            className="field"
            type="text"
            placeholder="ex. Zizou"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            maxLength={24}
          />
        </div>
      )}

      <div className="rise" style={{ animationDelay: "0.1s" }}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Email
        </label>
        <input
          className="field"
          type="email"
          placeholder="toi@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="rise" style={{ animationDelay: "0.15s" }}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Mot de passe
        </label>
        <input
          className="field"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={6}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-volt rise mt-1 flex items-center justify-center gap-2"
        style={{ animationDelay: "0.2s" }}
      >
        {loading ? "..." : isSignup ? "Créer mon compte" : "Entrer dans le jeu"}
      </button>

      <p
        className="rise mt-2 text-center text-sm text-muted"
        style={{ animationDelay: "0.25s" }}
      >
        {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-volt underline-offset-4 hover:underline"
        >
          {isSignup ? "Se connecter" : "S'inscrire"}
        </Link>
      </p>
    </form>
  );
}
