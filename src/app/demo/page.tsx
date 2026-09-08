'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { 
  Flame, 
  ShieldCheck, 
  UserCheck, 
  Wrench, 
  Users, 
  ArrowLeft,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { resetDemoStoreAction } from '@/app/actions/demoActions';

export default function DemoPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDemoLogin = async (email: string, roleName: string) => {
    setLoadingRole(roleName);
    try {
      await signIn('credentials', {
        email,
        password: 'demo123',
        callbackUrl: '/dashboard',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Błąd logowania w trybie demo.' });
      setLoadingRole(null);
    }
  };

  const handleResetDemo = async () => {
    if (confirm('Czy na pewno chcesz przywrócić fabryczne dane testowe w niezależnej bazie demo?')) {
      const res = await resetDemoStoreAction();
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Baza danych demo została zresetowana do stanu fabrycznego.' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0] flex flex-col justify-between font-sans">
      {/* BANER DEMO */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-brand-dark px-4 py-2 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-md">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>🎭 NIEZALEŻNY TRYB DEMO — Pełny portal (0 wpływu na bazę produkcyjną)</span>
      </div>

      {/* HEADER */}
      <header className="bg-[#1f1f1f] border-b border-white/10 px-6 py-4 flex items-center justify-between shadow-md">
        <Link href="/login" className="text-xs font-bold uppercase text-[#a0a0a0] hover:text-white flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5 transition">
          <ArrowLeft className="w-4 h-4" />
          <span>Formularz Logowania</span>
        </Link>

        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-brand-gold" />
          <span className="text-sm font-extrabold text-white uppercase tracking-wider font-display">
            DRIFT PARK <span className="text-brand-gold">EXTREME DEMO</span>
          </span>
        </div>

        <button
          onClick={handleResetDemo}
          className="text-xs font-bold uppercase tracking-wider bg-brand-red/20 hover:bg-brand-red/30 text-brand-red border border-brand-red/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resetuj Dane Demo</span>
        </button>
      </header>

      {/* OBSZAR KART 1-CLICK LOGIN */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-12 flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-gold/10 border border-brand-gold/30 rounded-full text-brand-gold text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pełna Wersja Testowa</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-wider font-display">
            Wybierz Profil do Przetestowania
          </h2>
          <p className="text-xs text-[#a0a0a0] leading-relaxed">
            Kliknięcie przycisku natychmiast przeniesie Cię do **pełnej wersji portalu** ze wszystkimi podstronami (grafik, karty godzin, checklisty, magazyn, wypłaty). Zmiany są odizolowane od Twojej bazy produkcyjnej.
          </p>
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-lg text-xs font-bold tracking-wide uppercase text-center w-full max-w-md ${
            statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* PRZYCISKI WCHODZENIA W DEMO (1-CLICK) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {/* KIEROWNIK */}
          <div className="glass-card p-6 rounded-2xl border border-brand-gold/30 bg-gradient-to-b from-brand-gold/5 to-transparent flex flex-col justify-between space-y-6 hover:border-brand-gold transition group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-brand-gold/20 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Kierownik Demo</h3>
                <p className="text-[11px] text-[#a0a0a0] mt-1">Pełne uprawnienia (grafik, magazyn, wypłaty, ustawienia)</p>
              </div>
            </div>
            <button
              onClick={() => handleDemoLogin('demo.manager@driftpark.pl', 'kierownik')}
              disabled={loadingRole !== null}
              className="w-full py-3 bg-gradient-to-r from-brand-gold to-yellow-500 text-brand-dark font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
            >
              {loadingRole === 'kierownik' ? 'Logowanie...' : 'Zaloguj jako Kierownik'}
            </button>
          </div>

          {/* PRACOWNIK */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col justify-between space-y-6 hover:border-white/20 transition group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Pracownik Demo</h3>
                <p className="text-[11px] text-[#a0a0a0] mt-1">Podgląd dyżurów, odbijanie RCP, checklisty i zadania</p>
              </div>
            </div>
            <button
              onClick={() => handleDemoLogin('demo.pracownik@driftpark.pl', 'pracownik')}
              disabled={loadingRole !== null}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-white/10"
            >
              {loadingRole === 'pracownik' ? 'Logowanie...' : 'Zaloguj jako Pracownik'}
            </button>
          </div>

          {/* TECHNIK */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col justify-between space-y-6 hover:border-white/20 transition group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Technik Demo</h3>
                <p className="text-[11px] text-[#a0a0a0] mt-1">Obsługa serwisowa gokartów, checklisty sprzętu</p>
              </div>
            </div>
            <button
              onClick={() => handleDemoLogin('demo.technik@driftpark.pl', 'technik')}
              disabled={loadingRole !== null}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-white/10"
            >
              {loadingRole === 'technik' ? 'Logowanie...' : 'Zaloguj jako Technik'}
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#1f1f1f] border-t border-white/10 px-6 py-3 text-center text-[10px] text-[#666] font-mono uppercase tracking-wider">
        System Czasu Pracy Drift Park Extreme • Tryb Demonstracyjny
      </footer>
    </div>
  );
}
