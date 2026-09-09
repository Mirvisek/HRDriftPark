'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  AlertCircle, 
  ArrowRight, 
  Banknote, 
  CalendarClock, 
  CheckCircle2, 
  ClipboardCheck, 
  FileText, 
  RefreshCw, 
  Save, 
  TriangleAlert,
  Play,
  Square,
  Sparkles,
  Clock,
  Lock,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import { 
  CashFormValues, 
  getTodayOverviewAction, 
  saveCashReconciliationAction, 
  saveShiftReportAction, 
  ShiftReportValues 
} from '@/app/actions/shiftOperationsActions';
import { 
  getActiveShiftAction, 
  startShiftAction, 
  stopShiftAction, 
  resetActiveShiftAction 
} from '@/app/actions/shiftServiceActions';
import { 
  ShiftRole, 
  SHIFT_ROLE_LABELS, 
  ActiveShiftInfo, 
  getRoleLabel, 
  ROLE_DESCRIPTIONS 
} from '@/lib/shiftTypes';
import { hasPermission } from '@/lib/permissions';

type Overview = Awaited<ReturnType<typeof getTodayOverviewAction>>['data'];
const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const emptyCash: CashFormValues = { openingCash: 0, closingCash: 0, fiscalReport: 0, terminalReport: 0, blikReport: 0, cashToBag: 0, eventCash: 0, cashOperations: 0, operationsDescription: '', differenceDescription: '' };
const emptyReport: ShiftReportValues = { intensity: 'standard', incidents: '', equipmentNotes: '', stockNotes: '', handoverNotes: '' };

export default function TodayPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [overview, setOverview] = useState<Overview>(undefined);
  const [cash, setCash] = useState<CashFormValues>(emptyCash);
  const [report, setReport] = useState<ShiftReportValues>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'cash' | 'report' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Stan usługi pracy (Punch-In / Punch-Out)
  const [activeShiftInfo, setActiveShiftInfo] = useState<ActiveShiftInfo | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [selectedRole, setSelectedRole] = useState<ShiftRole>('lead');
  const [submittingShiftAction, setSubmittingShiftAction] = useState(false);
  const [liveDuration, setLiveDuration] = useState<string>('');
  const [managerBypass, setManagerBypass] = useState(false);

  const canBypass = user && (user.role === 'owner' || hasPermission(user, 'timesheet:edit_all'));

  // Pobierz stan aktywnej zmiany
  const fetchShiftState = async () => {
    try {
      setLoadingShift(true);
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

  const load = async () => {
    setLoading(true);
    const result = await getTodayOverviewAction(date);
    if (result.success && result.data) {
      setOverview(result.data);
      const c = result.data.cash;
      if (c) setCash({ openingCash: c.openingCash, closingCash: c.closingCash, fiscalReport: c.fiscalReport, terminalReport: c.terminalReport, blikReport: c.blikReport, cashToBag: c.cashToBag, eventCash: c.eventCash, cashOperations: c.cashOperations, operationsDescription: c.operationsDescription || '', differenceDescription: c.differenceDescription || '' });
      const r = result.data.report;
      if (r) setReport({ intensity: r.intensity, incidents: r.incidents || '', equipmentNotes: r.equipmentNotes || '', stockNotes: r.stockNotes || '', handoverNotes: r.handoverNotes || '' });
    } else {
      setMessage(result.error || 'Nie udało się pobrać danych.');
    }
    setLoading(false);
    await fetchShiftState();
  };

  useEffect(() => {
    let active = true;
    void fetchShiftState();
    void getTodayOverviewAction(date).then(result => {
      if (!active) return;
      if (result.success && result.data) {
        setOverview(result.data);
        const c = result.data.cash;
        if (c) setCash({ openingCash: c.openingCash, closingCash: c.closingCash, fiscalReport: c.fiscalReport, terminalReport: c.terminalReport, blikReport: c.blikReport, cashToBag: c.cashToBag, eventCash: c.eventCash, cashOperations: c.cashOperations, operationsDescription: c.operationsDescription || '', differenceDescription: c.differenceDescription || '' });
        const r = result.data.report;
        if (r) setReport({ intensity: r.intensity, incidents: r.incidents || '', equipmentNotes: r.equipmentNotes || '', stockNotes: r.stockNotes || '', handoverNotes: r.handoverNotes || '' });
      } else {
        setMessage(result.error || 'Nie udało się pobrać danych.');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [date]);

  // Licznik na żywo czasu trwania zmiany
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

  // Obsługa startu zmiany
  const handleStartShift = async () => {
    setSubmittingShiftAction(true);
    setMessage(null);
    try {
      const roleToStart = selectedRole || 'lead';
      const res = await startShiftAction(roleToStart);
      if (res.success) {
        await fetchShiftState();
        setMessage(`Usługa pracy została włączona (${res.roleLabel || getRoleLabel(roleToStart)}) o godz. ${res.startTime || 'teraz'}!`);
      } else {
        setMessage(res.error || 'Błąd uruchamiania zmiany.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Błąd serwera.');
    } finally {
      setSubmittingShiftAction(false);
    }
  };

  // Obsługa stopu zmiany
  const handleStopShift = async () => {
    if (!confirm('Czy na pewno chcesz zakończyć dzisiejszą zmianę pracy i zarejestrować godziny w Karcie Godzin?')) {
      return;
    }

    setSubmittingShiftAction(true);
    setMessage(null);
    try {
      const res = await stopShiftAction();
      if (res.success) {
        await fetchShiftState();
        setMessage(`Zmiana zakończona pomyślnie (${res.duration || ''})! Wpis został zarejestrowany w Karcie Godzin.`);
      } else {
        setMessage(res.error || 'Błąd kończenia zmiany.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Błąd serwera.');
    } finally {
      setSubmittingShiftAction(false);
    }
  };

  // Obsługa awaryjnego resetu (gdy zmiana jest zablokowana lub uszkodzona)
  const handleResetShift = async () => {
    if (!confirm('Czy na pewno chcesz awaryjnie zresetować usługę pracy i zacząć od nowa?')) return;
    setSubmittingShiftAction(true);
    try {
      const res = await resetActiveShiftAction();
      if (res.success) {
        await fetchShiftState();
        setMessage('Status usługi pracy został pomyślnie zresetowany.');
      } else {
        setMessage(res.error || 'Błąd resetowania zmiany.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Błąd resetowania.');
    } finally {
      setSubmittingShiftAction(false);
    }
  };

  const calculated = Math.round(((cash.closingCash - cash.openingCash - cash.cashOperations) - (cash.fiscalReport - cash.terminalReport - cash.blikReport)) * 100) / 100;
  const updateCash = (field: keyof CashFormValues, value: string) => setCash(current => ({ ...current, [field]: typeof current[field] === 'number' ? Number(value) || 0 : value }));
  
  const saveCash = async (event: React.FormEvent) => { 
    event.preventDefault(); 
    setSaving('cash'); 
    setMessage(null); 
    const result = await saveCashReconciliationAction(date, cash); 
    setSaving(null); 
    setMessage(result.success ? `Rozliczenie zapisane. Kontrola: ${currency.format(result.checkAmount || 0)}` : result.error || 'Błąd zapisu.'); 
    if (result.success) void load(); 
  };

  const saveReport = async (event: React.FormEvent) => { 
    event.preventDefault(); 
    setSaving('report'); 
    setMessage(null); 
    const result = await saveShiftReportAction(date, report); 
    setSaving(null); 
    setMessage(result.success ? 'Raport zmiany zapisany.' : result.error || 'Błąd zapisu.'); 
    if (result.success) void load(); 
  };

  const checklistCard = (label: string, data: { total: number; done: number; problems: number } | undefined, href: string) => (
    <Link href={href} className="glass-card p-5 rounded-2xl border border-white/10 hover:border-brand-gold/40 transition">
      <div className="flex justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold">{label}</p>
          <p className="text-xl font-black text-white mt-1">{data?.done || 0}<span className="text-[#666]"> / {data?.total || 0}</span></p>
        </div>
        <ClipboardCheck className="w-6 h-6 text-brand-gold" />
      </div>
      {(data?.problems || 0) > 0 && <p className="text-[11px] mt-3 text-brand-red flex items-center gap-1"><TriangleAlert className="w-3.5 h-3.5" />Problemów: {data?.problems}</p>}
    </Link>
  );

  const isShiftActive = activeShiftInfo?.hasActiveShift;
  const currentRole = activeShiftInfo?.shift?.shiftRole;
  const isCleaningRole = currentRole === 'cleaning';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Nagłówek strony */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white font-display">PANEL <span className="text-brand-gold">DZISIAJ</span></h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            {new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="p-2.5 rounded-lg bg-[#1a1a1a] text-brand-gold hover:bg-[#252525] transition" title="Odśwież dane">
          <RefreshCw className={`w-4 h-4 ${loading || loadingShift ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Komunikat o stanie */}
      {message && (
        <div className="rounded-xl p-3 text-xs border border-brand-gold/25 bg-brand-gold/10 text-brand-gold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Jeśli zmiana jest aktywna: Czerwony pasek statusu zmiany z licznikiem i przyciskiem Zakończ */}
      {isShiftActive && activeShiftInfo?.shift && (
        <div className="bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border border-red-500/40 rounded-2xl p-4 sm:p-5 shadow-lg shadow-red-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center">
              <span className="w-4 h-4 rounded-full bg-red-500 animate-ping absolute opacity-75" />
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 relative" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-red-300">Usługa pracy: W TOKU</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-200 border border-red-500/30">
                  {getRoleLabel(activeShiftInfo.shift.shiftRole)}
                </span>
              </div>
              <p className="text-xs text-red-200/70 mt-1">
                Start: <strong className="text-white">{activeShiftInfo.shift.startTime || '—'}</strong> • Czas na żywo: <span className="font-mono font-bold text-white tracking-wider">{liveDuration || '00:00:00'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleStopShift}
              disabled={submittingShiftAction}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-red-400/50 shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              {submittingShiftAction ? 'Kończenie…' : 'Zakończ pracę'}
            </button>
            <button
              onClick={handleResetShift}
              disabled={submittingShiftAction}
              className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/60 hover:text-white border border-white/10 transition cursor-pointer"
              title="Awaryjny reset zablokowanej zmiany"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Banner trybu podglądu kierowniczego (gdy admin pominął start) */}
      {!isShiftActive && managerBypass && (
        <div className="rounded-xl p-3 text-xs border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Tryb podglądu menedżera — przeglądasz panel bez uruchamiania dyżuru i rejestracji godzin.</span>
          </div>
          <button
            onClick={() => setManagerBypass(false)}
            className="text-[11px] font-bold text-white hover:text-amber-200 flex items-center gap-1 underline underline-offset-2 shrink-0 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" /> Wróć do bramki wyboru
          </button>
        </div>
      )}

      {/* Blokada dla pracownika, jeśli NIE uruchomił usługi pracy */}
      {!isShiftActive && !managerBypass ? (
        <div className="glass-card rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6 text-center max-w-2xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto text-brand-gold">
            <Clock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-black text-white font-display uppercase tracking-wide">
              Rozpocznij pracę, aby otworzyć panel
            </h3>
            <p className="text-xs text-[#a0a0a0] mt-2 max-w-md mx-auto leading-relaxed">
              Zawartość operacyjna (kasa, raport zmiany, checklisty) jest dostępna po uruchomieniu usługi pracy. Wybierz swoją dzisiejszą rolę, aby system zarejestrował czas i odblokował narzędzia:
            </p>
          </div>

          {/* Wybór 4 ról */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {(['lead', 'support', 'cleaning', 'replacement'] as ShiftRole[]).map((role) => {
              const isSelected = selectedRole === role;
              const isSuggested = activeShiftInfo?.suggestedRole === role;
              const meta = ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.lead;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between relative cursor-pointer ${
                    isSelected
                      ? 'bg-brand-gold/15 border-brand-gold text-white shadow-lg shadow-brand-gold/10 ring-1 ring-brand-gold'
                      : 'bg-[#111] hover:bg-[#161616] border-white/10 text-[#bbb]'
                  }`}
                >
                  {isSuggested && (
                    <span className="absolute -top-2.5 right-3 bg-amber-400 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-2.5 h-2.5" /> Sugerowane z grafiku
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="font-bold text-sm text-white">{meta.title}</span>
                    </div>
                    <p className="text-[11px] text-[#888] mt-1.5 leading-relaxed">
                      {meta.desc}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-brand-gold bg-brand-gold' : 'border-white/30'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-brand-gold' : 'text-[#666]'}`}>
                      {isSelected ? 'Wybrana' : 'Wybierz rolę'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartShift}
              disabled={submittingShiftAction}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 hover:to-brand-gold text-[#121212] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-[#121212]" />
              {submittingShiftAction ? 'Uruchamianie usługi…' : `Rozpocznij pracę jako: ${getRoleLabel(selectedRole)}`}
            </button>
          </div>

          {canBypass && (
            <div className="pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setManagerBypass(true)}
                className="text-xs text-[#888] hover:text-brand-gold flex items-center gap-1.5 transition mx-auto cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Podgląd panelu w trybie menedżera (bez rejestracji godzin)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Pełna zawartość operacyjna odblokowana po starcie zmiany lub w trybie menedżera */
        <>
          <section className="grid md:grid-cols-4 gap-4">
            {checklistCard('Otwarcie', overview?.opening, '/checklists')}
            {checklistCard('Zamknięcie', overview?.closing, '/checklists')}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold">Kasa</p>
              <p className={`text-lg font-black mt-2 ${overview?.cash ? (overview.cash.checkAmount === 0 ? 'text-green-400' : 'text-brand-red') : 'text-[#666]'}`}>
                {overview?.cash ? (overview.cash.checkAmount === 0 ? 'Zgodna' : currency.format(overview.cash.checkAmount)) : 'Do rozliczenia'}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold">Raport zmiany</p>
              <p className={`text-lg font-black mt-2 ${overview?.report ? 'text-green-400' : 'text-[#666]'}`}>
                {overview?.report ? 'Zapisany' : 'Do uzupełnienia'}
              </p>
            </div>
          </section>

          {overview?.schedule && (
            <section className="glass-card p-5 rounded-2xl border border-white/10">
              <div className="flex gap-3">
                <CalendarClock className="w-5 h-5 text-brand-gold" />
                <div>
                  <p className="text-sm font-bold text-white">
                    Dzisiejsza zmiana {overview.schedule.isClosed ? '— lokal zamknięty' : `${overview.schedule.openTime || '—'}–${overview.schedule.closeTime || '—'}`}
                  </p>
                  {overview.schedule.eventRemarks && <p className="text-xs text-[#aaa] mt-1">Wydarzenie: {overview.schedule.eventRemarks}</p>}
                  {overview.schedule.remarks && <p className="text-xs text-[#777] mt-1">{overview.schedule.remarks}</p>}
                </div>
              </div>
            </section>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Formularz kasy: ukryty/zastąpiony dla roli 'Prace porządkowe' */}
            {isCleaningRole ? (
              <div className="glass-card rounded-2xl border border-white/10 p-6 flex flex-col justify-center items-center text-center space-y-3 bg-[#111]">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Rozliczenie kasy zablokowane</h3>
                <p className="text-xs text-[#888] max-w-sm leading-relaxed">
                  Pracujesz w roli <strong className="text-white">Prace porządkowe</strong>. Moduł rozliczenia kasy i sejfu jest dostępny wyłącznie dla osoby prowadzącej lub zamiany.
                </p>
              </div>
            ) : (
              <form onSubmit={saveCash} className="glass-card rounded-2xl border border-white/10 p-5 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-brand-gold" />
                  Rozliczenie kasy
                </h3>
                <p className="text-[11px] text-[#888]">Kontrola według obecnego arkusza Excel.</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['openingCash', 'Start dnia'],
                    ['closingCash', 'Koniec dnia'],
                    ['fiscalReport', 'Raport fiskalny'],
                    ['terminalReport', 'Raport terminal'],
                    ['blikReport', 'Raport BLIK'],
                    ['cashToBag', 'Do woreczka'],
                    ['eventCash', 'Urodziny / wycieczki'],
                    ['cashOperations', 'Operacje gotówkowe']
                  ] as [keyof CashFormValues, string][]).map(([key, label]) => (
                    <label key={key} className="text-[11px] text-[#aaa]">
                      {label}
                      <input 
                        type="number" 
                        step="0.01" 
                        value={cash[key] as number} 
                        onChange={e => updateCash(key, e.target.value)} 
                        className="mt-1 w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-sm text-white" 
                      />
                    </label>
                  ))}
                </div>
                <textarea 
                  value={cash.operationsDescription} 
                  onChange={e => updateCash('operationsDescription', e.target.value)} 
                  placeholder="Opis operacji gotówkowych" 
                  className="w-full min-h-16 p-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white" 
                />
                {calculated !== 0 && (
                  <textarea 
                    required 
                    value={cash.differenceDescription} 
                    onChange={e => updateCash('differenceDescription', e.target.value)} 
                    placeholder="Wyjaśnienie różnicy — wymagane" 
                    className="w-full min-h-16 p-3 bg-brand-red/5 border border-brand-red/30 rounded-lg text-xs text-white" 
                  />
                )}
                <div className={`p-3 rounded-lg text-sm font-bold ${calculated === 0 ? 'bg-green-500/10 text-green-400' : 'bg-brand-red/10 text-brand-red'}`}>
                  Sprawdzenie danych: {currency.format(calculated)}
                </div>
                <button disabled={saving === 'cash'} className="w-full py-2.5 rounded-lg bg-brand-gold text-[#151515] text-xs font-extrabold flex justify-center gap-2 cursor-pointer">
                  <Save className="w-4 h-4" />
                  {saving === 'cash' ? 'Zapisywanie…' : 'Zapisz rozliczenie'}
                </button>
              </form>
            )}

            {/* Formularz raportu zmiany */}
            <form onSubmit={saveReport} className="glass-card rounded-2xl border border-white/10 p-5 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-gold" />
                Raport końca zmiany
              </h3>
              <label className="text-[11px] text-[#aaa]">
                Intensywność dnia
                <select 
                  value={report.intensity} 
                  onChange={e => setReport(v => ({ ...v, intensity: e.target.value as ShiftReportValues['intensity'] }))} 
                  className="mt-1 w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-sm text-white"
                >
                  <option value="calm">Spokojnie</option>
                  <option value="standard">Standardowo</option>
                  <option value="busy">Bardzo intensywnie</option>
                </select>
              </label>
              {([
                ['incidents', 'Incydenty / problemy z klientami'],
                ['equipmentNotes', 'Usterki i sprzęt'],
                ['stockNotes', 'Braki magazynowe'],
                ['handoverNotes', 'Informacje dla kolejnej zmiany']
              ] as [keyof ShiftReportValues, string][]).map(([key, label]) => (
                <label key={key} className="block text-[11px] text-[#aaa]">
                  {label}
                  <textarea 
                    value={report[key] as string} 
                    onChange={e => setReport(v => ({ ...v, [key]: e.target.value }))} 
                    className="mt-1 w-full min-h-20 p-3 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white" 
                  />
                </label>
              ))}
              <button disabled={saving === 'report'} className="w-full py-2.5 rounded-lg bg-brand-gold text-[#151515] text-xs font-extrabold flex justify-center gap-2 cursor-pointer">
                <CheckCircle2 className="w-4 h-4" />
                {saving === 'report' ? 'Zapisywanie…' : 'Zapisz raport zmiany'}
              </button>
            </form>
          </div>

          <Link href="/checklists" className="text-xs text-brand-gold font-bold flex items-center gap-1">
            Przejdź do checklist <ArrowRight className="w-4 h-4" />
          </Link>
        </>
      )}
    </div>
  );
}
