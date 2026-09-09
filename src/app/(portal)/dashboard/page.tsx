'use client';

import { useState, useEffect } from 'react';
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
  ShieldCheck,
  Play,
  Square,
  Sparkles,
  X,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';
import { 
  getActiveShiftAction, 
  startShiftAction, 
  stopShiftAction, 
  SHIFT_ROLE_LABELS, 
  ActiveShiftInfo, 
  ShiftRole 
} from '@/app/actions/shiftServiceActions';

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [activeShiftInfo, setActiveShiftInfo] = useState<ActiveShiftInfo | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ShiftRole>('lead');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<string>('');

  // Pobierz stan aktywnej zmiany przy montowaniu
  const fetchShiftState = async () => {
    try {
      const res = await getActiveShiftAction();
      setActiveShiftInfo(res);
      if (res.suggestedRole) {
        setSelectedRole(res.suggestedRole);
      }
    } catch (e) {
      console.error('Błąd pobierania aktywnej zmiany:', e);
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    fetchShiftState();
  }, []);

  // Timer czasu trwania zmiany na żywo
  useEffect(() => {
    if (!activeShiftInfo?.hasActiveShift || !activeShiftInfo.shift?.startedAt) {
      setLiveDuration('');
      return;
    }

    const updateTimer = () => {
      const startTime = new Date(activeShiftInfo.shift!.startedAt!).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - startTime);

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      setLiveDuration(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeShiftInfo]);

  const handleStartShift = async () => {
    setSubmittingAction(true);
    setStatusMessage(null);
    try {
      const res = await startShiftAction(selectedRole);
      if (res.success) {
        setShowStartModal(false);
        await fetchShiftState();
        setStatusMessage(`Usługa pracy została włączona (${res.roleLabel}) o godz. ${res.startTime}!`);
      } else {
        setStatusMessage(res.error || 'Błąd uruchamiania zmiany.');
      }
    } catch (e: any) {
      setStatusMessage(e.message || 'Błąd serwera.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleStopShift = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!confirm('Czy na pewno chcesz zakończyć dzisiejszą zmianę pracy i zarejestrować godziny w Karcie Godzin?')) {
      return;
    }

    setSubmittingAction(true);
    setStatusMessage(null);
    try {
      const res = await stopShiftAction();
      if (res.success) {
        await fetchShiftState();
        setStatusMessage(`Zmiana zakończona pomyślnie (${res.duration})! Wpis został dodany do Twojej Karty Godzin.`);
      } else {
        setStatusMessage(res.error || 'Błąd kończenia zmiany.');
      }
    } catch (e: any) {
      setStatusMessage(e.message || 'Błąd serwera.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const isShiftActive = activeShiftInfo?.hasActiveShift;
  const currentRoleLabel = activeShiftInfo?.shift ? SHIFT_ROLE_LABELS[activeShiftInfo.shift.shiftRole] : '';

  const tiles = [
    {
      title: isShiftActive ? 'DZISIAJ (ZMIANA W TOKU)' : 'DZISIAJ (PANEL ZMIANY)',
      subtitle: isShiftActive 
        ? `🔴 W pracy od ${activeShiftInfo?.shift?.startTime} (${currentRoleLabel})${liveDuration ? ` • ${liveDuration}` : ''}`
        : 'Podsumowanie i operacje dnia',
      href: '/today',
      icon: Sun,
      color: isShiftActive 
        ? 'bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 border-red-400/50 shadow-red-950/60 ring-2 ring-red-500/40 animate-pulse'
        : 'bg-[#186f75] hover:bg-[#1f878e]',
      show: true,
      customAction: isShiftActive ? (
        <div className="flex items-center gap-2 mt-1">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleStopShift();
            }}
            className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-white/20 transition cursor-pointer"
          >
            <Square className="w-3 h-3 text-red-200 fill-red-200" /> Zakończ
          </span>
        </div>
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowStartModal(true);
          }}
          className="mt-1 px-2.5 py-1 rounded bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-brand-gold/30 transition cursor-pointer"
        >
          <Play className="w-3 h-3 fill-brand-gold" /> Rozpocznij pracę
        </span>
      ),
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

  const roleOptions: { key: ShiftRole; title: string; desc: string; icon: string }[] = [
    {
      key: 'lead',
      title: 'Osoba prowadząca',
      desc: 'Obsługa toru, kasy fiskalnej, raportów i odpowiedzialność za lokal',
      icon: '🏆',
    },
    {
      key: 'support',
      title: 'Osoba wspomagająca',
      desc: 'Wsparcie na torze, odprawy klientów, checklisty operacyjne',
      icon: '🤝',
    },
    {
      key: 'cleaning',
      title: 'Prace porządkowe',
      desc: 'Sprzątanie toru, salek, zaplecza (bez obsługi kasy fiskalnej)',
      icon: '🧹',
    },
    {
      key: 'replacement',
      title: 'Zamiana osoby prowadzącej',
      desc: 'Zastępstwo za zaplanowaną osobę prowadzącą',
      icon: '🔄',
    },
  ];

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

      {statusMessage && (
        <div className="max-w-2xl mx-auto p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="ml-2 text-white/60 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SIATKA KAFELKÓW (3 KOLUMNY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {visibleTiles.map((tile, idx) => {
          const Icon = tile.icon;
          return (
            <Link
              key={idx}
              href={tile.href}
              className={`${tile.color} text-white font-extrabold p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 h-36 md:h-44 active:scale-95 border border-white/10 group cursor-pointer relative overflow-hidden`}
            >
              <Icon className="w-7 h-7 md:w-9 md:h-9 text-white/90 group-hover:scale-110 transition-transform" />
              <span className="text-xs md:text-sm tracking-wider uppercase">{tile.title}</span>
              <span className="text-[10px] text-white/70 font-normal normal-case max-w-[200px] truncate">{tile.subtitle}</span>
              {tile.customAction}
            </Link>
          );
        })}
      </div>

      {/* MODAL WYBORU ROLI I STARTU USŁUGI PRACY */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-white font-display uppercase tracking-wide">
                  Rozpocznij usługę pracy
                </h3>
                <p className="text-xs text-[#a0a0a0] mt-0.5">
                  Wybierz w jakim charakterze pełnisz dzisiejszy dyżur:
                </p>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-[#888] hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {roleOptions.map((opt) => {
                const isSelected = selectedRole === opt.key;
                const isSuggested = activeShiftInfo?.suggestedRole === opt.key;

                return (
                  <div
                    key={opt.key}
                    onClick={() => setSelectedRole(opt.key)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-brand-gold/15 border-brand-gold text-white shadow-lg'
                        : 'bg-[#181818] border-white/10 text-[#bbb] hover:border-white/20 hover:bg-[#202020]'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-white tracking-wide">
                          {opt.title}
                        </span>
                        {isSuggested && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] font-bold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Według grafiku
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#888] mt-0.5 leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowStartModal(false)}
                disabled={submittingAction}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-[#aaa] hover:text-white hover:bg-white/5 text-xs font-bold transition"
              >
                Anuluj
              </button>
              <button
                onClick={handleStartShift}
                disabled={submittingAction}
                className="flex-1 py-2.5 rounded-xl bg-brand-gold hover:bg-yellow-400 text-brand-dark text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-lg"
              >
                {submittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uruchamianie...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Rozpocznij
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
