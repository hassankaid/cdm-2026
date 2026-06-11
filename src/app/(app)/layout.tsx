import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PullToRefresh } from "@/components/pull-to-refresh";

// Layout des écrans connectés : la barre de navigation y est toujours présente.
// (L'authentification est déjà imposée par le proxy/middleware.)
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegister />
      <PullToRefresh />
      {children}
      <BottomNav />
    </>
  );
}
