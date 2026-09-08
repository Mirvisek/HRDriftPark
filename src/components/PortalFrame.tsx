'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Home, LogOut } from 'lucide-react';

interface PortalFrameProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function PortalFrame({ children, user }: PortalFrameProps) {
  const router = useRouter();
  const pathname = usePathname();
  const userName = user?.name || user?.email || 'Pracownik';

  const handleBack = () => {
    if (pathname === '/dashboard' || pathname === '/') {
      // Na pulpicie głównym brak cofania do ekranu logowania
      return;
    }
    router.back();
  };

  return (
    <div className="min-h-screen bg-[#141414] text-[#e0e0e0] flex flex-col justify-between font-sans">
      {/* GÓRNY PASEK NAWIGACJI (HEADER BAR) */}
      <header className="bg-[#333333] border-b border-white/10 text-white px-4 md:px-8 py-3 flex items-center justify-between shadow-md shrink-0 sticky top-0 z-30">
        <button
          onClick={handleBack}
          disabled={pathname === '/dashboard' || pathname === '/'}
          className={`text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 py-1 px-3 rounded ${
            pathname === '/dashboard' || pathname === '/'
              ? 'text-[#666666] cursor-not-allowed'
              : 'text-[#a0a0a0] hover:text-white hover:bg-white/5 cursor-pointer'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>

        <div className="text-xs md:text-sm font-extrabold tracking-wider text-[#ffd700] uppercase font-display text-center truncate px-2">
          {userName}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-brand-red transition flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded hover:bg-white/5"
        >
          <span>Wyloguj</span>
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* GŁÓWNY OBSZAR TREŚCI */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto">
        {children}
      </main>

      {/* DOLNY PASEK NAWIGACJI (FOOTER BAR) */}
      <footer className="bg-[#333333] border-t border-white/10 text-white px-4 md:px-8 py-3 flex items-center justify-between shadow-md shrink-0 sticky bottom-0 z-30">
        <Link
          href="/dashboard"
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-brand-gold transition flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5"
        >
          <Home className="w-4 h-4" />
          <span>Główna</span>
        </Link>

        <button
          onClick={handleBack}
          disabled={pathname === '/dashboard' || pathname === '/'}
          className={`text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 py-1 px-3 rounded ${
            pathname === '/dashboard' || pathname === '/'
              ? 'text-[#666666] cursor-not-allowed'
              : 'text-[#a0a0a0] hover:text-white hover:bg-white/5 cursor-pointer'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>
      </footer>
    </div>
  );
}
