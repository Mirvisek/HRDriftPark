'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getAvailability, saveAvailability, reviewAvailability, checkIsLocked, AvailabilityEntry } from '@/app/actions/availabilityActions';
import { getEmployees, sendSystemNotification, UserEntry } from '@/app/actions/userActions';
import { Calendar as CalendarIcon, Check, X, ShieldAlert, AlertTriangle, Send, Lock, Unlock, RefreshCw } from 'lucide-react';

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const currentUser = session?.user ? {
    id: Number((session.user as any).id) || 1, // Fallback dla id demo
    role: (session.user as any).role || 'employee',
    name: session.user.name || 'Pracownik',
    isDemo: (session.user as any).isDemo || false
  } : null;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(1);
  const [employees, setEmployees] = useState<UserEntry[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityEntry>>({});
  const [loading, setLoading] = useState(false);
  const [simulatedPost15, setSimulatedPost15] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'employees'>('my');
  const [notificationMsg, setNotificationMsg] = useState('Twoja dyspozycyjność została zaakceptowana.');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Pomiary kalendarza
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
  // Konwertujemy na poniedziałek jako pierwszy dzień: 0 (Pon) - 6 (Niedz)
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Pobieranie pracowników
  useEffect(() => {
    if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager')) {
      getEmployees().then((res: any) => {
        if (res.success) {
          setEmployees(res.data);
          // Ustaw pierwszego pracownika (innego niż ja sam, jeśli to możliwe)
          const other = res.data.find((u: any) => u.id !== currentUser.id);
          if (other) setSelectedEmployeeId(other.id);
          else if (res.data.length > 0) setSelectedEmployeeId(res.data[0].id);
        }
      });
    }
  }, [currentUser]);

  // Sprawdzanie czy edycja jest zablokowana
  useEffect(() => {
    if (!currentUser) return;
    
    // Sprawdzamy dla 1. dnia wybranego miesiąca
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    checkIsLocked(dateStr, currentUser.role).then((locked: boolean) => {
      setIsLocked(simulatedPost15 ? true : locked);
    });
  }, [currentDate, currentUser, simulatedPost15, month, year]);

  // Pobieranie dyspozycyjności
  const fetchAvailability = async () => {
    if (!currentUser) return;
    setLoading(true);
    const targetUserId = viewMode === 'my' ? currentUser.id : selectedEmployeeId;
    
    const res = await getAvailability(targetUserId, year, month + 1);
    
    const newMap: Record<string, AvailabilityEntry> = {};
    
    // Najpierw pobierz dane z localStorage, jeśli baza jest niedostępna lub to tryb demo
    let localData: AvailabilityEntry[] = [];
    try {
      const stored = localStorage.getItem(`availability_${targetUserId}_${year}_${month + 1}`);
      if (stored) localData = JSON.parse(stored);
    } catch (e) {}

    // Łączymy wyniki
    if (res.success && res.data.length > 0) {
      res.data.forEach((item: AvailabilityEntry) => {
        newMap[item.date] = item;
      });
      setStatusMsg(null);
    } else {
      // Używamy danych lokalnych w przypadku błędu bazy
      localData.forEach((item: AvailabilityEntry) => {
        newMap[item.date] = item;
      });
      if (!res.success) {
        setStatusMsg({
          type: 'warning',
          text: "Brak bazy danych. Pracujesz w trybie offline (dane zapisywane w przeglądarce)."
        });
      }
    }
    
    setAvailabilityMap(newMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchAvailability();
  }, [viewMode, selectedEmployeeId, currentDate, currentUser]);

  const handleDayClick = async (dayNum: number) => {
    if (!currentUser) return;
    if (viewMode === 'employees') return; // Manager przegląda, nie klika w ten sposób

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    
    if (isLocked) {
      setStatusMsg({ type: 'error', text: 'Zapis zablokowany. Edycja dyspozycyjności po 15-stym dniu miesiąca jest wyłączona.' });
      return;
    }

    const currentEntry = availabilityMap[dateStr];
    let nextStatus: 'available' | 'unavailable' | null = null;
    
    if (!currentEntry) {
      nextStatus = 'available';
    } else if (currentEntry.status === 'available') {
      nextStatus = 'unavailable';
    } else {
      nextStatus = null; // Powrót do braku wyboru
    }

    // Nowy wpis / Aktualizacja lokalnego stanu
    const updatedMap = { ...availabilityMap };
    
    if (nextStatus === null) {
      delete updatedMap[dateStr];
    } else {
      updatedMap[dateStr] = {
        userId: currentUser.id,
        date: dateStr,
        status: nextStatus,
        statusManager: 'pending'
      };
    }
    
    setAvailabilityMap(updatedMap);

    // Zapisz do localStorage na wypadek braku bazy
    try {
      const arr = Object.values(updatedMap);
      localStorage.setItem(`availability_${currentUser.id}_${year}_${month + 1}`, JSON.stringify(arr));
    } catch (e) {}

    // Zapis do serwera/bazy
    if (nextStatus !== null) {
      const res = await saveAvailability(currentUser.id, dateStr, nextStatus);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zapisano status dla dnia ${dayNum} w bazie.` });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu.' });
        // Przywróć poprzedni stan
        fetchAvailability();
      }
    } else {
      // Usuwanie wpisu z serwera (zapisz jako unavailable / available lub obsłuż usuwanie)
      // W naszej uproszczonej logice po prostu wyłączamy status na serwerze
      // Dla uproszczenia, w Drizzle możemy po prostu zaktualizować na status
      const res = await saveAvailability(currentUser.id, dateStr, 'unavailable', 'deleted');
      if (!res.success) {
        fetchAvailability();
      }
    }
  };

  // Manager akceptuje/odrzuca
  const handleManagerReview = async (dateStr: string, status: 'accepted' | 'rejected') => {
    const entry = availabilityMap[dateStr];
    if (!entry) return;

    const updatedMap = { ...availabilityMap };
    const oldStatus = entry.statusManager;
    entry.statusManager = status;
    updatedMap[dateStr] = entry;
    setAvailabilityMap(updatedMap);

    // Zapisz lokalnie
    const targetUserId = selectedEmployeeId;
    try {
      localStorage.setItem(`availability_${targetUserId}_${year}_${month + 1}`, JSON.stringify(Object.values(updatedMap)));
    } catch (e) {}

    // Jeśli to wpis z id (baza), to zaktualizuj na serwerze
    if (entry.id) {
      const res = await reviewAvailability(entry.id, status);
      if (!res.success) {
        setStatusMsg({ type: 'error', text: 'Błąd podczas aktualizacji w bazie danych.' });
        entry.statusManager = oldStatus;
        setAvailabilityMap({ ...availabilityMap, [dateStr]: entry });
      } else {
        setStatusMsg({ type: 'success', text: `Zaktualizowano status dnia ${dateStr} na: ${status === 'accepted' ? 'Zaakceptowany' : 'Odrzucony'}` });
      }
    } else {
      // Wpis z localStorage/Demo bez ID
      setStatusMsg({ type: 'success', text: `Zaktualizowano status w trybie demo dla dnia ${dateStr}.` });
    }
  };

  // Manager wysyła powiadomienie
  const handleSendNotification = async () => {
    const res = await sendSystemNotification(selectedEmployeeId, notificationMsg);
    if (res.success) {
      setStatusMsg({
        type: 'success',
        text: `Wysłano powiadomienie systemowe do pracownika.`
      });
    } else {
      setStatusMsg({ type: 'error', text: 'Błąd podczas wysyłania powiadomienia.' });
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const monthNames = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
            DYSPOZYCYJNOŚĆ <span className="text-brand-gold">PRACOWNIKÓW</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Określ swoje dni dostępności na nadchodzący miesiąc lub zarządzaj dyspozycyjnością zespołu.
          </p>
        </div>

        {/* View Mode Tabs */}
        {currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager') && (
          <div className="flex bg-[#0a0a0a] border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('my')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${viewMode === 'my' ? 'bg-brand-gold text-brand-dark' : 'text-[#a0a0a0] hover:text-white'}`}
            >
              Moja Dyspozycyjność
            </button>
            <button
              onClick={() => setViewMode('employees')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${viewMode === 'employees' ? 'bg-brand-gold text-brand-dark' : 'text-[#a0a0a0] hover:text-white'}`}
            >
              Przegląd Zespołu
            </button>
          </div>
        )}
      </div>

      {/* Status Bar */}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            {/* Header Kalendarza */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-brand-gold" />
                <h3 className="text-lg font-bold text-white font-display">
                  {monthNames[month]} {year}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={prevMonth}
                  className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-lg text-xs font-bold text-white transition cursor-pointer"
                >
                  ← Poprzedni
                </button>
                <button
                  onClick={nextMonth}
                  className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-lg text-xs font-bold text-white transition cursor-pointer"
                >
                  Następny →
                </button>
              </div>
            </div>

            {/* Lock / Off-15 alert */}
            {viewMode === 'my' && (
              <div className={`mb-4 px-4 py-2 rounded-lg flex items-center gap-2 text-xs border ${isLocked ? 'bg-brand-red/10 border-brand-red/20 text-brand-red' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                {isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Edycja zablokowana (minął 15. dzień poprzedniego miesiąca).</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Edycja otwarta (dostępna do 15. dnia poprzedniego miesiąca).</span>
                  </>
                )}
              </div>
            )}

            {/* Grid Kalendarza */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#a0a0a0] mb-2">
              <div>Pn</div>
              <div>Wt</div>
              <div>Śr</div>
              <div>Cz</div>
              <div>Pt</div>
              <div>Sb</div>
              <div>Nd</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Puste dni na początku */}
              {Array.from({ length: adjustedFirstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square bg-transparent" />
              ))}

              {/* Dni miesiąca */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const entry = availabilityMap[dateStr];
                
                let bgClass = "bg-[#161616] border-white/5 hover:border-white/20 text-white";
                let statusBadge = null;

                if (entry) {
                  if (entry.status === 'available') {
                    bgClass = "bg-green-950/40 border-green-500/30 hover:border-green-500/60 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.05)]";
                  } else if (entry.status === 'unavailable') {
                    bgClass = "bg-red-950/40 border-brand-red/30 hover:border-brand-red/60 text-brand-red shadow-[0_0_8px_rgba(255,51,51,0.05)]";
                  }
                }

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => handleDayClick(dayNum)}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-between p-2 transition cursor-pointer relative group ${bgClass} ${isLocked && viewMode === 'my' ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    <span className="text-sm font-bold">{dayNum}</span>
                    
                    {entry && (
                      <span className={`text-[8px] px-1 py-0.5 rounded font-extrabold uppercase ${
                        entry.statusManager === 'accepted' ? 'bg-green-500/20 text-green-400' :
                        entry.statusManager === 'rejected' ? 'bg-brand-red/20 text-brand-red' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {entry.statusManager === 'accepted' ? 'OK' :
                         entry.statusManager === 'rejected' ? 'X' : '?'}
                      </span>
                    )}

                    {/* Przycisk akceptacji/odrzucenia dla managera w widoku przeglądu zespołu */}
                    {viewMode === 'employees' && entry && entry.statusManager === 'pending' && (
                      <div className="absolute inset-0 bg-[#0f0f0f]/90 rounded-xl flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleManagerReview(dateStr, 'accepted'); }}
                          className="p-1 bg-green-500 text-brand-dark rounded hover:scale-110 transition cursor-pointer"
                          title="Zaakceptuj"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleManagerReview(dateStr, 'rejected'); }}
                          className="p-1 bg-brand-red text-white rounded hover:scale-110 transition cursor-pointer"
                          title="Odrzuć"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {viewMode === 'employees' && entry && entry.statusManager !== 'pending' && (
                      <div className="absolute inset-0 bg-[#0f0f0f]/95 rounded-xl flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
                        <span className="text-[9px] text-[#a0a0a0]">Zmień status:</span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleManagerReview(dateStr, 'accepted'); }}
                            className="px-1 py-0.5 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-brand-dark rounded text-[8px] cursor-pointer"
                          >
                            Tak
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleManagerReview(dateStr, 'rejected'); }}
                            className="px-1 py-0.5 bg-brand-red/20 hover:bg-brand-red text-brand-red hover:text-white rounded text-[8px] cursor-pointer"
                          >
                            Nie
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info / Manager Actions Panel */}
        <div className="space-y-6">
          {/* Legenda i Pomoc */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-md font-bold text-white mb-4 font-display">Legenda Statusów</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-green-950/40 border border-green-500/30" />
                <div>
                  <div className="font-semibold text-white">Dostępny</div>
                  <div className="text-[10px] text-[#a0a0a0]">Pracownik deklaruje gotowość do pracy.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-red-950/40 border border-brand-red/30" />
                <div>
                  <div className="font-semibold text-white">Niedostępny</div>
                  <div className="text-[10px] text-[#a0a0a0]">Dzień wyłączony z możliwości planowania.</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-[#161616] border border-white/5" />
                <div>
                  <div className="font-semibold text-white">Brak deklaracji</div>
                  <div className="text-[10px] text-[#a0a0a0]">Status neutralny (nieokreślony).</div>
                </div>
              </div>
            </div>
            {viewMode === 'my' && !isLocked && (
              <p className="text-[11px] text-[#ffd700]/70 mt-6 bg-brand-gold/5 p-3 rounded-lg border border-brand-gold/10">
                💡 <strong>Wskazówka:</strong> Klikaj na dni w kalendarzu, aby szybko zmieniać swój status w pętli: Dostępny → Niedostępny → Brak deklaracji. Zapis następuje automatycznie.
              </p>
            )}
          </div>

          {/* Panel Menedżerski (Wybór pracownika i powiadomienia) */}
          {viewMode === 'employees' && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-md font-bold text-white font-display">Panel Menedżera</h3>
              
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                  Wybierz pracownika
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                  Wyślij powiadomienie Push / System
                </label>
                <textarea
                  value={notificationMsg}
                  onChange={(e) => setNotificationMsg(e.target.value)}
                  placeholder="Treść powiadomienia..."
                  className="w-full h-20 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-xs placeholder-white/20 focus:outline-none focus:border-brand-gold resize-none"
                />
                <button
                  onClick={handleSendNotification}
                  className="w-full py-2 bg-brand-gold text-brand-dark font-bold text-xs rounded-lg hover:bg-yellow-400 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Wyślij Powiadomienie</span>
                </button>
              </div>
            </div>
          )}

          {/* Narzędzia symulacji blokad (Widoczne dla Menedżera / Właściciela do celów testowych) */}
          {currentUser && (currentUser.role === 'owner' || currentUser.role === 'manager') && (
            <div className="glass-card rounded-2xl p-6 border border-brand-gold/10 bg-brand-gold/5 space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-brand-gold tracking-wider flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>Narzędzia Testowe</span>
              </h4>
              <p className="text-[10px] text-[#a0a0a0]">
                Użyj poniższego przełącznika, aby przetestować automatyczne zablokowanie edycji po 15-stym dniu miesiąca.
              </p>
              <label className="flex items-center gap-3 text-xs text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulatedPost15}
                  onChange={(e) => setSimulatedPost15(e.target.checked)}
                  className="w-4 h-4 accent-brand-gold bg-[#1a1a1a] border-white/10 rounded"
                />
                <span className="font-semibold">Symuluj blokadę (po 15. dniu)</span>
              </label>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
