import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navigation } from "@/components/Navigation";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as any).mustChangePassword) {
    redirect("/change-password");
  }

  const isDemo = (session.user as any).isDemo === true;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0f0f0f] text-[#e0e0e0] font-sans">
      {/* Nawigacja (Desktop sidebar oraz Mobile header & drawer) */}
      <Navigation user={session.user} />

      {/* Główna treść */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Baner trybu demo */}
        {isDemo && (
          <div style={{
            background: 'linear-gradient(90deg, #b8860b 0%, #ffd700 50%, #b8860b 100%)',
            color: '#0a0a0a',
            textAlign: 'center',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            flexShrink: 0
          }}>
            🎭 TRYB DEMO — Dane są w pełni odizolowane od systemu produkcyjnego. Wszystkie zmiany widoczne tylko w tym trybie.
          </div>
        )}
        <main className="flex-1 bg-[#121212] p-6 md:p-10 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

