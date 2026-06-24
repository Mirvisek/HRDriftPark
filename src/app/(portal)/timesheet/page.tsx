'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { getTimesheets, saveTimesheet, deleteTimesheet, checkTimesheetLocked, TimesheetEntry } from '@/app/actions/timesheetActions';
import { checkConflicts } from '@/lib/timesheetUtils';
import { Plus, Trash2, FileText, Lock, Unlock, AlertTriangle, RefreshCw, X, ShieldAlert, Edit2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { TimesheetPDF } from '@/components/TimesheetPDF';

// Dynamiczny import linku pobierania react-pdf, aby uniknąć błędów SSR (Server-Side Rendering)
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

export default function TimesheetPage() {
  const { data: session } = useSession();
  const currentUser = session?.user ? {
    id: Number((session.user as any).id) || 1,
    name: session.user.name || 'Pracownik',
    role: (session.user as any).role || 'employee',
    position: (session.user as any).position || 'Pracownik toru',
    isDemo: (session.user as any).isDemo || false
  } : null;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [simulatedLocked, setSimulatedLocked] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formStart, setFormStart] = useState('10:00');
  const [formEnd, setFormEnd] = useState('18:00');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  const monthNames = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  const memoizedPDF = useMemo(() => {
    if (!currentUser) return null;
    return (
      <TimesheetPDF
        entries={entries}
        employeeName={currentUser.name}
        position={currentUser.position}
        monthName={monthNames[month]}
        year={year}
        month={month}
      />
    );
  }, [entries, currentUser, month, year]);

  useEffect(() => {
    setIsMounted(true);
    // Ustaw dzisiejszą datę w formularzu jako domyślną
    const today = new Date();
    setFormDate(today.toISOString().split('T')[0]);
  }, []);

  // Sprawdzanie czy karta pracy jest zablokowana
  useEffect(() => {
    if (!currentUser) return;
    checkTimesheetLocked(year, month, currentUser.role).then((locked: boolean) => {
      setIsLocked(simulatedLocked ? true : locked);
    });
  }, [currentDate, currentUser?.role, simulatedLocked, year, month]);

  const fetchTimesheetsList = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await getTimesheets(currentUser.id, year, month);
    
    // Załaduj z localStorage jako fallback
    let localData: TimesheetEntry[] = [];
    try {
      const stored = localStorage.getItem(`timesheets_${currentUser.id}_${year}_${month}`);
      if (stored) localData = JSON.parse(stored);
    } catch (e) {}

    if (res.success) {
      setEntries(res.data);
      setConflicts(checkConflicts(res.data));
      setStatusMsg(null);
    } else {
      setEntries(localData);
      setConflicts(checkConflicts(localData));
      setStatusMsg({
        type: 'warning',
        text: "Brak bazy danych. Pracujesz w trybie offline (dane zapisywane w przeglądarce)."
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTimesheetsList();
  }, [currentDate, currentUser?.id]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError(null);

    // Walidacja
    if (!formDate || !formStart || !formEnd) {
      setFormError('Wszystkie pola są wymagane.');
      return;
    }
    if (formStart >= formEnd) {
      setFormError('Godzina rozpoczęcia musi być wcześniejsza niż godzina zakończenia.');
      return;
    }

    if (editingEntry) {
      // Przepływ edycji
      const updated = entries.map(item => 
        item.id === editingEntry.id 
          ? { ...item, date: formDate, startTime: formStart, endTime: formEnd, remarks: formRemarks || '' }
          : item
      );

      // Zapisz lokalnie
      try {
        localStorage.setItem(`timesheets_${currentUser.id}_${year}_${month}`, JSON.stringify(updated));
      } catch (err) {}

      // Zapis do serwera
      const res = await saveTimesheet(
        editingEntry.id, // ID edytowanego wpisu
        currentUser.id,
        formDate,
        formStart,
        formEnd,
        formRemarks
      );

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Pomyślnie zaktualizowano wpis w karcie godzin.' });
        setShowAddForm(false);
        setFormRemarks('');
        setEditingEntry(null);
        fetchTimesheetsList();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu w bazie danych.' });
        setShowAddForm(false);
        setFormRemarks('');
        setEditingEntry(null);
      }
    } else {
      // Przepływ dodawania
      const newEntry: TimesheetEntry = {
        userId: currentUser.id,
        date: formDate,
        startTime: formStart,
        endTime: formEnd,
        remarks: formRemarks || '',
        isLocked: false
      };

      const updated = [...entries, newEntry];

      // Zapisz lokalnie
      try {
        localStorage.setItem(`timesheets_${currentUser.id}_${year}_${month}`, JSON.stringify(updated));
      } catch (err) {}

      // Zapis do serwera
      const res = await saveTimesheet(
        undefined, // Brak ID = nowy wpis
        currentUser.id,
        formDate,
        formStart,
        formEnd,
        formRemarks
      );

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Pomyślnie dodano wpis do karty godzin.' });
        setShowAddForm(false);
        setFormRemarks('');
        fetchTimesheetsList();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu w bazie danych.' });
        setShowAddForm(false);
        setFormRemarks('');
      }
    }
  };

  const handleEditClick = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormStart(entry.startTime);
    setFormEnd(entry.endTime);
    setFormRemarks(entry.remarks || '');
    setFormError(null);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number | undefined, index: number) => {
    if (!currentUser) return;

    if (isLocked) {
      setStatusMsg({ type: 'error', text: 'Karta pracy na ten miesiąc jest zablokowana.' });
      return;
    }

    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    setConflicts(checkConflicts(updated));

    // Zapis lokalny
    try {
      localStorage.setItem(`timesheets_${currentUser.id}_${year}_${month}`, JSON.stringify(updated));
    } catch (e) {}

    if (id) {
      const res = await deleteTimesheet(id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Usunięto wpis z karty godzin.' });
      } else {
        setStatusMsg({ type: 'warning', text: 'Usunięto lokalnie. ' + (res.error || '') });
      }
    } else {
      setStatusMsg({ type: 'success', text: 'Usunięto wpis lokalny.' });
    }
  };

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? (diff / 60).toFixed(2) : '0.00';
  };

  const calculateTotalHours = () => {
    let total = 0;
    entries.forEach(e => {
      total += Number(calculateHours(e.startTime, e.endTime));
    });
    return total.toFixed(2);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
            KARTA <span className="text-brand-gold">GODZIN PRACY</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Rejestruj przepracowane godziny i generuj miesięczne rozliczenie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={() => {
                setEditingEntry(null);
                const today = new Date();
                setFormDate(today.toISOString().split('T')[0]);
                setFormStart('10:00');
                setFormEnd('18:00');
                setFormRemarks('');
                setFormError(null);
                setShowAddForm(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-xs rounded-lg shadow-lg hover:shadow-brand-red/10 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Dodaj Wpis</span>
            </button>
          )}

          {isMounted && currentUser && memoizedPDF && (
            <PDFDownloadLink
              document={memoizedPDF}
              fileName={`karta_godzin_${currentUser.name.replace(/\s+/g, '_')}_${monthNames[month]}_${year}.pdf`}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 rounded-lg text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer"
            >
              {({ loading }) => (
                <>
                  <FileText className="w-4 h-4 text-brand-gold" />
                  <span>{loading ? 'Generowanie...' : 'Eksportuj PDF'}</span>
                </>
              )}
            </PDFDownloadLink>
          )}

          <div className="flex bg-[#0a0a0a] border border-white/10 rounded-lg p-1">
            <button onClick={prevMonth} className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer">←</button>
            <span className="px-4 py-1 text-xs font-bold text-white flex items-center">{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer">→</button>
          </div>
        </div>
      </div>

      {/* Lock alert banner */}
      <div className={`p-4 rounded-lg flex items-center gap-3 text-sm border ${
        isLocked ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' : 'bg-green-500/10 border-green-500/20 text-green-400'
      }`}>
        {isLocked ? (
          <>
            <Lock className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Karta została zablokowana do edycji.</span> Ostatni dzień miesiąca po godzinie 22:00 minął. Zmiany nie są już dozwolone.
            </div>
          </>
        ) : (
          <>
            <Unlock className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Karta jest otwarta do edycji.</span> Możesz dodawać i usuwać swoje wpisy. Blokada nastąpi automatycznie ostatniego dnia miesiąca o 22:00.
            </div>
          </>
        )}
      </div>

      {/* Status Msg */}
      {statusMsg && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm border ${
          statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
          statusMsg.type === 'error' ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' :
          'bg-brand-gold/10 border-brand-gold/20 text-brand-gold'
        }`}>
          {statusMsg.type === 'error' ? <ShieldAlert className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="ml-auto text-xs opacity-50 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Conflict / Overlapping Warnings */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-brand-red/15 border border-brand-red/30 rounded-xl text-brand-red text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <AlertTriangle className="w-4.5 h-4.5" />
            <span>Wykryto nakładanie się zmian (konflikty godzin)!</span>
          </div>
          <p>
            System wykrył nakładające się przedziały godzinowe dla tego samego pracownika w następujących dniach: <span className="font-extrabold">{conflicts.join(', ')}</span>. Te dni zostaną oznaczone na czerwono w panelu menedżera. Popraw swoje wpisy.
          </p>
        </div>
      )}

      {/* Timesheet List Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table list */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-[#e0e0e0]">
              <thead className="bg-[#0a0a0a] border-b border-white/10 text-xs font-extrabold uppercase tracking-wider text-[#a0a0a0] font-display">
                <tr>
                  <th className="py-4 px-6">Data</th>
                  <th className="py-4 px-6">Start</th>
                  <th className="py-4 px-6">Koniec</th>
                  <th className="py-4 px-6 text-center">Suma</th>
                  <th className="py-4 px-6">Uwagi</th>
                  {!isLocked && <th className="py-4 px-6 text-right">Akcje</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#121212]">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={isLocked ? 5 : 6} className="py-8 text-center text-xs text-[#555] italic">
                      Brak wpisów godzinowych dla wybranego miesiąca.
                    </td>
                  </tr>
                ) : (
                  [...entries]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((entry, index) => {
                      const hasConflict = conflicts.includes(entry.date);
                      return (
                        <tr
                          key={entry.id || index}
                          className={`hover:bg-[#1a1a1a] transition ${hasConflict ? 'bg-brand-red/5 hover:bg-brand-red/10' : ''}`}
                        >
                          <td className={`py-4 px-6 font-bold ${hasConflict ? 'text-brand-red' : 'text-white'}`}>
                            {entry.date} {hasConflict && '⚠️'}
                          </td>
                          <td className="py-4 px-6 font-mono text-xs">{entry.startTime}</td>
                          <td className="py-4 px-6 font-mono text-xs">{entry.endTime}</td>
                          <td className="py-4 px-6 text-center font-extrabold text-brand-gold text-xs">
                            {calculateHours(entry.startTime, entry.endTime)}h
                          </td>
                          <td className="py-4 px-6 text-xs text-[#a0a0a0] max-w-xs truncate">{entry.remarks || '—'}</td>
                          {!isLocked && (
                            <td className="py-4 px-6 text-right flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(entry)}
                                className="p-1.5 hover:bg-brand-gold/10 text-[#555] hover:text-brand-gold rounded-lg transition cursor-pointer"
                                title="Edytuj wpis"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id, index)}
                                className="p-1.5 hover:bg-brand-red/10 text-[#555] hover:text-brand-red rounded-lg transition cursor-pointer"
                                title="Usuń wpis"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          {/* Total Worked */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden">
            {/* Warning stripes element at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 racing-stripes" />
            
            <h3 className="text-xs font-bold text-[#a0a0a0] uppercase tracking-wider">Przepracowane Godziny</h3>
            <div className="text-5xl font-black text-white font-display tracking-tight">
              {calculateTotalHours()}<span className="text-brand-gold text-2xl font-bold ml-1">h</span>
            </div>
            <p className="text-[10px] text-[#555]">
              Suma godzin z zatwierdzonych i oczekujących wpisów w wybranym miesiącu.
            </p>
          </div>

          {/* Narzędzia symulacji blokad (Widoczne dla Menedżera / Właściciela do celów testowych) */}
          {currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager' || currentUser.role === 'technik') && (
            <div className="glass-card rounded-2xl p-6 border border-brand-gold/10 bg-brand-gold/5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-brand-gold tracking-wider flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>Narzędzia Testowe</span>
              </h4>
              <p className="text-[10px] text-[#a0a0a0]">
                Użyj przełącznika, aby zasymulować zablokowanie karty czasu pracy o godzinie 22:00 ostatniego dnia miesiąca.
              </p>
              <label className="flex items-center gap-3 text-xs text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulatedLocked}
                  onChange={(e) => setSimulatedLocked(e.target.checked)}
                  className="w-4 h-4 accent-brand-gold bg-[#1a1a1a] border-white/10 rounded"
                />
                <span className="font-semibold">Symuluj blokadę karty (koniec m-ca 22:00)</span>
              </label>
            </div>
          )}
        </div>

      </div>

      {/* Add Entry Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md relative border border-white/10 shadow-2xl">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 text-[#a0a0a0] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6 font-display flex items-center gap-2">
              {editingEntry ? (
                <Edit2 className="w-5 h-5 text-brand-gold" />
              ) : (
                <Plus className="w-5 h-5 text-brand-red" />
              )}
              <span>{editingEntry ? 'Edytuj wpis godzin pracy' : 'Dodaj wpis godzin pracy'}</span>
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">Data</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">Rozpoczęcie</label>
                  <input
                    type="time"
                    required
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">Zakończenie</label>
                  <input
                    type="time"
                    required
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">Uwagi / Zadania</label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="np. Instruktor Drift Co-Drive 250, obsługa toru"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-brand-red/20 transition cursor-pointer"
              >
                {editingEntry ? 'Zapisz zmiany' : 'Dodaj do ewidencji'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
