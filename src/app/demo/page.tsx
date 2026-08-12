'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ensureDemoDataAction } from '@/app/actions/demoActions';
import { User, Shield, Wrench, Users, ArrowRight, Loader2 } from 'lucide-react';

export default function DemoPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectRole = async (roleName: string, email: string) => {
    setLoadingRole(roleName);
    setErrorMsg(null);
    try {
      // 1. Zapewnij obecność kont i danych testowych w bazie
      const res = await ensureDemoDataAction();
      if (!res.success) {
        throw new Error(res.error || 'Nie udało się zainicjować danych demonstracyjnych.');
      }

      // 2. Wywołaj logowanie z Next-Auth
      const signInRes = await signIn("credentials", {
        email,
        password: "demo123",
        redirect: true,
        callbackUrl: "/"
      });

      if (signInRes?.error) {
        throw new Error("Błąd autoryzacji: " + signInRes.error);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Wystąpił nieoczekiwany błąd podczas logowania.');
      setLoadingRole(null);
    }
  };

  const roles = [
    {
      name: 'Właściciel toru (Owner)',
      role: 'owner',
      email: 'wlasciciel@driftpark.pl',
      icon: Shield,
      color: 'from-red-500 to-orange-500',
      shadow: 'shadow-red-500/10',
      description: 'Pełen panel administratora i zarządcy. Kadry, stawki płac, uprawnienia pracowników, edycja ustawień systemowych, finanse oraz pełen wgląd w stany magazynowe lokali.',
      features: ['Kadry & Stawki płac', 'Zarządzanie uprawnieniami', 'Finanse toru', 'Zarządzanie magazynem']
    },
    {
      name: 'Menedżer zmiany (Manager)',
      role: 'manager',
      email: 'menedzer@driftpark.pl',
      icon: Users,
      color: 'from-amber-500 to-yellow-500',
      shadow: 'shadow-amber-500/10',
      description: 'Układanie grafików, zatwierdzanie czasu pracy pracowników, rozliczanie RCP, wprowadzanie dostaw oraz przydzielanie zadań operacyjnych na zmianie.',
      features: ['Układanie grafików', 'Zatwierdzanie RCP', 'Zadania zmiany', 'Wprowadzanie dostaw']
    },
    {
      name: 'Technik / Serwisant (Technik)',
      role: 'technik',
      email: 'technik@driftpark.pl',
      icon: Wrench,
      color: 'from-blue-500 to-indigo-500',
      shadow: 'shadow-blue-500/10',
      description: 'Wykonywanie przeglądów technicznych gokartów, odbiór części serwisowych ze słownika, inwentaryzacja działu technicznego, zarządzanie naprawami.',
      features: ['Zadania serwisowe', 'Przyjęcia części', 'Inwentaryzacja techniczna', 'Statusy gokartów']
    },
    {
      name: 'Pracownik toru (Employee)',
      role: 'employee',
      email: 'pracownik@driftpark.pl',
      icon: User,
      color: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-500/10',
      description: 'Rejestracja czasu pracy RCP (Wejście/Wyjście), sprawdzanie własnego grafiku zmian, wykonywanie checklist oraz cotygodniowych inwentaryzacji.',
      features: ['Logowanie RCP', 'Podgląd grafiku', 'Wykonywanie zadań', 'Spot-checki magazynu']
    }
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand-red/10 blur-[150px]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-brand-gold/5 blur-[150px]" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-red to-brand-gold flex items-center justify-center font-black text-black tracking-tighter text-lg shadow-lg shadow-brand-red/20">
            DP
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-white">Drift Park</h1>
            <p className="text-[10px] text-brand-gold font-bold tracking-widest uppercase -mt-1">Extreme Management</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-brand-gold tracking-wider">
          Tryb Demo
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-7xl w-full mx-auto px-6 py-8 z-10">
        <div className="text-center max-w-2xl space-y-3 mb-10">
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white leading-none">
            Witaj w <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-red via-brand-gold to-yellow-500">Panelu Prezentacyjnym</span>
          </h2>
          <p className="text-xs md:text-sm text-[#888] leading-relaxed">
            Wybierz dowolną rolę poniżej, aby natychmiast wejść do systemu. System automatycznie wygeneruje dane demonstracyjne (grafik, magazyn, zadania, RCP), prezentując pełne możliwości oprogramowania.
          </p>
        </div>

        {errorMsg && (
          <div className="max-w-md w-full mb-6 p-4 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-xl text-xs font-bold text-center animate-fadeIn">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = loadingRole === r.name;
            const isAnyLoading = loadingRole !== null;

            return (
              <div
                key={r.name}
                className={`glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between relative group hover:border-white/15 transition-all duration-300 ${r.shadow} ${
                  isAnyLoading && !isSelected ? 'opacity-40 pointer-events-none scale-[0.98]' : 'scale-100'
                }`}
              >
                {/* Accent line top */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${r.color} rounded-t-2xl`} />

                <div className="space-y-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-black stroke-[2.5]" />
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{r.name}</h3>
                    <p className="text-[10px] text-[#555] font-mono">{r.email}</p>
                  </div>

                  <p className="text-xs text-[#888] leading-relaxed min-h-[90px]">{r.description}</p>

                  {/* Features tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {r.features.map(f => (
                      <span key={f} className="text-[9px] bg-white/5 border border-white/5 text-[#a0a0a0] px-2 py-0.5 rounded font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => handleSelectRole(r.name, r.email)}
                    disabled={isAnyLoading}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected 
                        ? 'bg-white text-black' 
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 group-hover:border-brand-gold group-hover:text-brand-gold'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Logowanie...</span>
                      </>
                    ) : (
                      <>
                        <span>Zaloguj jako {r.role}</span>
                        <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-[10px] text-[#444] z-10 shrink-0 border-t border-white/5">
        Drift Park Extreme Management Portal &bull; System demonstracyjny &bull; Wszelkie prawa zastrzeżone 2026
      </footer>
    </div>
  );
}
