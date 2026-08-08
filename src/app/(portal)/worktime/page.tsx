'use client';

import Link from 'next/link';
import { CalendarDays, Calendar, Clock, ArrowRight } from 'lucide-react';

export default function WorkTimePage() {
  const categories = [
    {
      href: "/availability",
      title: "Dyspozycyjność",
      description: "Określ swoje preferencje czasowe, zaplanuj wolne dni oraz zadeklaruj gotowość do pracy w bieżącym lub nadchodzącym miesiącu.",
      icon: CalendarDays,
      color: "from-brand-gold to-yellow-500",
      shadow: "shadow-brand-gold/10"
    },
    {
      href: "/schedule",
      title: "Grafik Pracy",
      description: "Sprawdź zaplanowane dyżury, godziny rozpoczęcia i zakończenia zmian oraz obsadę stanowisk na torze driftowym.",
      icon: Calendar,
      color: "from-brand-red to-orange-600",
      shadow: "shadow-brand-red/10"
    },
    {
      href: "/timesheet",
      title: "Karta Godzin",
      description: "Zapisuj przepracowany czas, kontroluj bieżące zarobki i weryfikuj zgodność godzin z zaplanowanym grafikiem.",
      icon: Clock,
      color: "from-blue-500 to-indigo-600",
      shadow: "shadow-blue-500/10"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 md:p-10 min-h-[calc(100vh-100px)] flex flex-col justify-center">
      {/* Nagłówek */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight uppercase font-display">
          Centrum <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red via-brand-gold to-brand-red">Czasu Pracy</span>
        </h2>
        <p className="text-xs md:text-sm text-[#a0a0a0] max-w-xl mx-auto leading-relaxed">
          Wybierz odpowiednią sekcję, aby zarządzać swoją dyspozycyjnością, przeglądać grafik lub wprowadzać przepracowane godziny.
        </p>
      </div>

      {/* Grid Kafelków */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <Link 
              key={c.href} 
              href={c.href}
              className={`glass-card p-6 md:p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between group shadow-xl ${c.shadow} relative overflow-hidden`}
            >
              {/* Ozdobny gradient w rogu */}
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.color} opacity-5 blur-2xl group-hover:opacity-10 transition duration-300`} />
              
              <div className="space-y-4 relative">
                {/* Ikona w gradiencie */}
                <div className={`w-12 h-12 bg-gradient-to-tr ${c.color} rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition duration-300`}>
                  <Icon className="w-6 h-6 text-brand-dark" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-black text-white group-hover:text-brand-gold transition duration-200 uppercase tracking-wide">
                    {c.title}
                  </h3>
                  <p className="text-xs text-[#a0a0a0] leading-relaxed">
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Dolny przycisk przejścia */}
              <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-gold group-hover:text-white transition duration-200">
                <span>Przejdź dalej</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition duration-300" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
