import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Inscription"
      subtitle="Crée ton compte et rejoins la partie."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
