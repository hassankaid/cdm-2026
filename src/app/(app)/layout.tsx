import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

// Layout des écrans connectés : la barre de navigation y est toujours présente.
// (L'authentification est déjà imposée par le proxy/middleware.)
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegister />
      {children}
      <BottomNav />
    </>
  );
}
