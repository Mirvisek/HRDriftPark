'use client';

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function DemoBar() {
  const { data: session } = useSession();
  
  if (!session?.user || !(session.user as any).isDemo) {
    return null;
  }

  const roleLabels: Record<string, string> = {
    owner: "Właściciel",
    manager: "Manager",
    employee: "Pracownik",
  };

  const userRole = (session.user as any).role || 'employee';
  const roleName = roleLabels[userRole] || userRole;

  return (
    <div className="bg-brand-gold/10 border-b border-brand-gold/20 text-brand-gold px-4 py-2.5 text-xs flex justify-between items-center z-50 relative font-mono tracking-wide">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-pulse shrink-0 shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
        <span>
          <strong>TRYB DEMO</strong> — Zalogowano jako: <span className="uppercase font-extrabold text-white bg-brand-gold/20 px-1.5 py-0.5 rounded text-[10px]">{roleName}</span> ({ (session.user as any).position })
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden md:inline text-[#a0a0a0] text-[10px]">
          Efekty zewnętrzne (e-maile / powiadomienia push) są zablokowane i mockowane.
        </span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 hover:text-white hover:bg-brand-red transition cursor-pointer font-bold text-brand-gold border border-brand-gold/20 bg-brand-gold/5 px-2.5 py-1 rounded"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Wyloguj</span>
        </button>
      </div>
    </div>
  );
}
