'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Sun, 
  CalendarDays, 
  Calendar, 
  Clock, 
  ClipboardCheck, 
  ClipboardList, 
  Package, 
  DollarSign, 
  Settings,
  PartyPopper,
  AlertTriangle,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const tiles = [
    {
      title: 'DZISIAJ (PANEL ZMIANY)',
      subtitle: 'Podsumowanie i operacje dnia',
      href: '/today',
      icon: Sun,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'GRAFIK PRACY',
      subtitle: 'Planowanie dyżurów i obsada',
      href: '/schedule',
      icon: CalendarDays,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'schedule:view'),
    },
    {
      title: 'CENTRUM ALERTÓW',
      subtitle: 'Wyjątki, manka i anomalia',
      href: '/alerts',
      icon: AlertTriangle,
      color: 'bg-[#8a2be2] hover:bg-[#9932cc]',
      show: hasPermission(user, 'timesheet:view_all') || hasPermission(user, 'schedule:edit') || hasPermission(user, 'payroll:view') || (user as any)?.role === 'owner' || (user as any)?.role === 'manager',
    },
    {
      title: 'REZERWACJE & EVENTY',
      subtitle: 'Imprezy i rezerwacje toru',
      href: '/events',
      icon: PartyPopper,
      color: 'bg-[#d97706] hover:bg-[#b45309]',
      show: true,
    },
    {
      title: 'DOSTĘPNOŚĆ',
      subtitle: 'Zgłaszanie dyspozycyjności',
      href: '/availability',
      icon: Calendar,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'KARTA GODZIN (RCP)',
      subtitle: 'Rejestracja wejść i wyjść',
      href: '/timesheet',
      icon: Clock,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'timesheet:view_own'),
    },
    {
      title: 'CHECKLISTY',
      subtitle: 'Otwarcie i zamknięcie lokalu',
      href: '/checklists',
      icon: ClipboardCheck,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'ZADANIA NA ZMIANIE',
      subtitle: 'Lista zadań operacyjnych',
      href: '/tasks',
      icon: ClipboardList,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'tasks:view'),
    },
    {
      title: 'MAGAZYN & WYDANIA',
      subtitle: 'Stany magazynowe i dostawy',
      href: '/magazyn',
      icon: Package,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'inventory:view'),
    },
    {
      title: 'EXECUTIVE ANALITYKA',
      subtitle: 'Dashboard finansowy Właściciela',
      href: '/analytics',
      icon: BarChart3,
      color: 'bg-[#2563eb] hover:bg-[#1d4ed8]',
      show: hasPermission(user, 'payroll:view') || (user as any)?.role === 'owner',
    },
    {
      title: 'WYPŁATY / PAYROLL',
      subtitle: 'Rozliczenia stawek i premii',
      href: '/admin/payroll',
      icon: DollarSign,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'payroll:view'),
    },
    {
      title: 'BEZPIECZEŃSTWO & SESJE',
      subtitle: 'Aktywne urządzenia i tokeny',
      href: '/settings/security',
      icon: ShieldCheck,
      color: 'bg-[#475569] hover:bg-[#334155]',
      show: true,
    },
    {
      title: 'USTAWIENIA & KONTO',
      subtitle: 'Konfiguracja i użytkownicy',
      href: '/settings',
      icon: Settings,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'settings:edit') || hasPermission(user, 'users:manage'),
    },
  ];

  const visibleTiles = tiles.filter(t => t.show);

  return (
    <div className="py-2 md:py-6 space-y-6">
      {/* NAGŁÓWEK SEKCI KAFELKÓW */}
      <div className="text-center space-y-1">
        <h2 className="text-lg md:text-xl font-extrabold text-white uppercase tracking-wider font-display">
          Pulpit Nawigacyjny
        </h2>
        <p className="text-xs text-[#a0a0a0]">
          Wybierz moduł, aby przejść do obsługi systemu
        </p>
      </div>

      {/* SIATKA KAFELKÓW (3 KOLUMNY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {visibleTiles.map((tile, idx) => {
          const Icon = tile.icon;
          return (
            <Link
              key={idx}
              href={tile.href}
              className={`${tile.color} text-white font-extrabold p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 h-32 md:h-40 active:scale-95 border border-white/10 group cursor-pointer`}
            >
              <Icon className="w-7 h-7 md:w-9 md:h-9 text-white/90 group-hover:scale-110 transition-transform" />
              <span className="text-xs md:text-sm tracking-wider uppercase">{tile.title}</span>
              <span className="text-[10px] text-white/70 font-normal normal-case">{tile.subtitle}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
