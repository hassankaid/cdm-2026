import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <AuthShell title="Connexion" subtitle="Reprends ta place dans le classement.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
