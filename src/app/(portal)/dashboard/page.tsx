'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  LogOut, 
  ArrowLeft, 
  Home,
  ShieldAlert
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const user = session?.user;
  const userName = user?.name || 'Pracownik';

  const tiles = [
    {
      title: 'DZISIAJ (PANEL ZMIANY)',
      href: '/today',
      icon: Sun,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'GRAFIK PRACY',
      href: '/schedule',
      icon: CalendarDays,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'DOSTĘPNOŚĆ',
      href: '/availability',
      icon: Calendar,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'KARTA GODZIN (RCP)',
      href: '/timesheet',
      icon: Clock,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'CHECKLISTY',
      href: '/checklists',
      icon: ClipboardCheck,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'ZADANIA NA ZMIANIE',
      href: '/tasks',
      icon: ClipboardList,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
    },
    {
      title: 'MAGAZYN & WYDANIA',
      href: '/magazyn',
      icon: Package,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'inventory:view'),
    },
    {
      title: 'WYPŁATY / PAYROLL',
      href: '/admin/payroll',
      icon: DollarSign,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'payroll:view'),
    },
    {
      title: 'USTAWIENIA & KONTO',
      href: '/settings',
      icon: Settings,
      color: 'bg-[#186f75] hover:bg-[#1f878e]',
      show: hasPermission(user, 'settings:edit') || hasPermission(user, 'users:manage'),
    },
  ];

  const visibleTiles = tiles.filter(t => t.show);

  return (
    <div className="min-h-screen bg-[#d4dadc] text-[#111111] flex flex-col justify-between -m-6 md:-m-10">
      {/* GÓRNY PASEK (TOP HEADER BAR) */}
      <header className="bg-[#333333] text-white px-6 py-3 flex items-center justify-between shadow-md shrink-0">
        <button
          onClick={() => router.back()}
          className="text-xs font-bold uppercase hover:text-brand-gold transition flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>

        <div className="text-sm font-extrabold tracking-wide text-[#ffd700] uppercase font-display">
          {userName}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs font-bold uppercase hover:text-red-400 transition flex items-center gap-1 cursor-pointer"
        >
          <span>Wyloguj</span>
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* SIATKA KAFELKÓW (TILE GRID CONTAINER) */}
      <main className="flex-1 p-6 md:p-12 max-w-6xl w-full mx-auto flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 w-full">
          {visibleTiles.map((tile, idx) => {
            const Icon = tile.icon;
            return (
              <Link
                key={idx}
                href={tile.href}
                className={`${tile.color} text-white font-extrabold text-xs md:text-sm tracking-wider uppercase p-6 rounded-md shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center text-center gap-3 h-28 md:h-36 active:scale-95 border border-white/10`}
              >
                <Icon className="w-6 h-6 md:w-8 md:h-8 opacity-90" />
                <span>{tile.title}</span>
              </Link>
            );
          })}
        </div>
      </main>

      {/* DOLNY PASEK NAWIGACYJNY (FOOTER BAR) */}
      <footer className="bg-[#333333] text-white px-6 py-3 flex items-center justify-between shadow-md shrink-0">
        <Link
          href="/dashboard"
          className="text-xs font-bold uppercase hover:text-brand-gold transition flex items-center gap-1"
        >
          <Home className="w-4 h-4" />
          <span>Główna</span>
        </Link>

        <button
          onClick={() => router.back()}
          className="text-xs font-bold uppercase hover:text-brand-gold transition flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>
      </footer>
    </div>
  );
}
