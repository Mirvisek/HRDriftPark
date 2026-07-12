'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getWorkSchedule, saveWorkScheduleEntry, generateSchedule, ScheduleEntry } from '@/app/actions/scheduleActions';
import { getEmployees, UserEntry } from '@/app/actions/userActions';
import { CalendarDays, Save, Sparkles, RefreshCw, CheckCircle, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function SchedulePage() {
  const { data: session } = useSession();
  const currentUser = session?.user ? {
    role: (session.user as any).role || 'employee',
    isDemo: (session.user as any).isDemo || false
  } : null;

  const isManagerOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'manager' || currentUser?.role === 'technik';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleList, setScheduleList] = useState<ScheduleEntry[]>([]);
  const [employees, setEmployees] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  const monthNames = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  // Pobierz listę pracowników
  useEffect(() => {
    getEmployees().then((res: any) => {
      if (res.success) {
        setEmployees(res.data);
      }
    });
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    const res = await getWorkSchedule(year, month);
    
    // Pobierz z localStorage jako fallback
    let localData: ScheduleEntry[] = [];
    try {
      const stored = localStorage.getItem(`schedule_${year}_${month}`);
      if (stored) localData = JSON.parse(stored);
    } catch (e) {}

    if (res.success && res.data.length > 0) {
      setScheduleList(res.data);
      setStatusMsg(null);
    } else {
      // Jeśli brak bazy, tworzymy pusty szablon dni lub używamy localData
      const daysCount = new Date(year, month, 0).getDate();
      const mockList: ScheduleEntry[] = [];
      
      for (let d = 1; d <= daysCount; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const existing = localData.find(item => item.date === dateStr);
        if (existing) {
          mockList.push(existing);
        } else {
          mockList.push({
            date: dateStr,
            leadUserId: null,
            supportUserId: null,
            remarks: ''
          });
        }
      }
      setScheduleList(mockList);
      if (!res.success) {
        setStatusMsg({
          type: 'warning',
          text: "Brak bazy danych. Pracujesz w trybie offline (dane zapisywane w przeglądarce)."
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedule();
  }, [currentDate]);

  // Obsługa automatycznego generowania
  const handleAutoGenerate = async () => {
    setGenerating(true);
    setStatusMsg({ type: 'warning', text: 'Trwa generowanie grafiku...' });
    const res = await generateSchedule(year, month);
    setGenerating(false);

    if (res.success && res.data) {
      setScheduleList(res.data);
      // Zapisz lokalnie
      try {
        localStorage.setItem(`schedule_${year}_${month}`, JSON.stringify(res.data));
      } catch (e) {}

      setStatusMsg({
        type: 'success',
        text: `Wygenerowano grafik automatycznie na podstawie zaakceptowanych dyspozycyjności pracowników!`
      });
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Nie udało się wygenerować grafiku.' });
    }
  };

  // Obsługa ręcznej zmiany przez menedżera
  const handleCellChange = async (
    dateStr: string,
    field: 'leadUserId' | 'supportUserId' | 'remarks' | 'eventRemarks' | 'eventUserIds' | 'openTime' | 'closeTime' | 'isClosed',
    value: any
  ) => {
    const updated = scheduleList.map(item => {
      if (item.date === dateStr) {
        if (field === 'leadUserId') {
          const emp = employees.find(e => e.id === Number(value));
          return { ...item, leadUserId: value ? Number(value) : null, leadName: emp ? emp.name : undefined };
        } else if (field === 'supportUserId') {
          const emp = employees.find(e => e.id === Number(value));
          return { ...item, supportUserId: value ? Number(value) : null, supportName: emp ? emp.name : undefined };
        } else if (field === 'isClosed') {
          return { ...item, isClosed: Boolean(value) };
        } else {
          return { ...item, [field]: value };
        }
      }
      return item;
    });

    setScheduleList(updated);

    // Zapisz w localStorage
    try {
      localStorage.setItem(`schedule_${year}_${month}`, JSON.stringify(updated));
    } catch (e) {}

    // Wyślij na serwer
    const targetItem = updated.find(item => item.date === dateStr);
    if (targetItem) {
      const res = await saveWorkScheduleEntry(
        dateStr,
        targetItem.leadUserId,
        targetItem.supportUserId,
        targetItem.remarks,
        targetItem.eventRemarks || null,
        targetItem.eventUserIds || null,
        targetItem.openTime || null,
        targetItem.closeTime || null,
        targetItem.isClosed || false
      );
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zapisano zmiany w grafiku dla dnia ${dateStr}.` });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu w bazie danych.' });
      }
    }
  };

  const getDayName = (dateStr: string) => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const getDefaultHours = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota
    if (day === 1) {
      return { isClosed: true, openTime: '15:00', closeTime: '20:00', label: 'Zamknięte' };
    } else if (day >= 2 && day <= 5) {
      return { isClosed: false, openTime: '15:00', closeTime: '20:00', label: '15:00 - 20:00' };
    } else {
      return { isClosed: false, openTime: '12:00', closeTime: '20:00', label: '12:00 - 20:00' };
    }
  };

  const getDisplayHours = (entry: ScheduleEntry) => {
    if (entry.isClosed) {
      return 'Zamknięte';
    }
    const defaults = getDefaultHours(entry.date);
    if (entry.isClosed === undefined || entry.isClosed === null) {
      if (defaults.isClosed) return 'Zamknięte';
    }
    const open = entry.openTime || defaults.openTime;
    const close = entry.closeTime || defaults.closeTime;
    return `${open} - ${close}`;
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
            GRAFIK <span className="text-brand-gold">PRACY</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Miesięczny plan obsady toru Drift Park Extreme.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManagerOrOwner && (
            <button
              onClick={handleAutoGenerate}
              disabled={generating || loading}
              className="px-4 py-2 bg-gradient-to-r from-brand-gold to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-brand-dark font-extrabold text-xs rounded-lg shadow-lg hover:shadow-brand-gold/10 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Wygeneruj grafik</span>
            </button>
          )}

          <div className="flex bg-[#0a0a0a] border border-white/10 rounded-lg p-1">
            <button
              onClick={prevMonth}
              className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer"
            >
              ←
            </button>
            <span className="px-4 py-1 text-xs font-bold text-white flex items-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer"
            >
              →
            </button>
          </div>
        </div>
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

      {/* Schedule Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-[#e0e0e0]">
            <thead className="bg-[#0a0a0a] border-b border-white/10 text-xs font-extrabold uppercase tracking-wider text-[#a0a0a0] font-display">
              <tr>
                <th className="py-4 px-4 w-[12%]">Dzień</th>
                <th className="py-4 px-4 w-[22%]">Godziny otwarcia</th>
                <th className="py-4 px-4 w-[25%]">Obsada główna</th>
                <th className="py-4 px-4 w-[25%]">Wydarzenie specjalne</th>
                <th className="py-4 px-4 w-[16%]">Uwagi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#121212]">
              {scheduleList.map((entry) => {
                const dayNum = new Date(entry.date).getDate();
                const dayName = getDayName(entry.date);
                const isWeekend = dayName === 'Sobota' || dayName === 'Niedziela';

                const defaults = getDefaultHours(entry.date);
                const currentOpen = entry.openTime || defaults.openTime;
                const currentClose = entry.closeTime || defaults.closeTime;
                const currentClosed = entry.isClosed !== undefined && entry.isClosed !== null ? entry.isClosed : defaults.isClosed;

                const assignedUserIds = entry.eventUserIds ? entry.eventUserIds.split(',').map(Number) : [];
                const toggleEventUser = (userId: number, checked: boolean) => {
                  let newIds = [...assignedUserIds];
                  if (checked) {
                    if (!newIds.includes(userId)) newIds.push(userId);
                  } else {
                    newIds = newIds.filter(id => id !== userId);
                  }
                  handleCellChange(entry.date, 'eventUserIds', newIds.length > 0 ? newIds.join(',') : null);
                };

                return (
                  <tr
                    key={entry.date}
                    className={`hover:bg-[#1a1a1a] transition ${isWeekend ? 'bg-brand-gold/[0.01]' : ''}`}
                  >
                    {/* Dzień */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-md">{dayNum}.</div>
                      <div className={`text-[10px] font-semibold ${isWeekend ? 'text-brand-gold' : 'text-[#a0a0a0]'}`}>
                        {dayName}
                      </div>
                    </td>

                    {/* Godziny otwarcia */}
                    <td className="py-3 px-4">
                      {isManagerOrOwner ? (
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={currentClosed}
                              onChange={(e) => handleCellChange(entry.date, 'isClosed', e.target.checked)}
                              className="w-3.5 h-3.5 accent-brand-gold bg-[#1e1e1e] border-white/10 rounded"
                            />
                            <span className={currentClosed ? 'text-brand-red font-semibold' : ''}>Zamknięte</span>
                          </label>
                          {!currentClosed && (
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={currentOpen}
                                onChange={(e) => handleCellChange(entry.date, 'openTime', e.target.value)}
                                className="px-1.5 py-1 bg-[#1e1e1e] border border-white/10 rounded text-[11px] text-white font-mono focus:outline-none focus:border-brand-gold"
                              />
                              <span className="text-[#555]">-</span>
                              <input
                                type="time"
                                value={currentClose}
                                onChange={(e) => handleCellChange(entry.date, 'closeTime', e.target.value)}
                                className="px-1.5 py-1 bg-[#1e1e1e] border border-white/10 rounded text-[11px] text-white font-mono focus:outline-none focus:border-brand-gold"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`font-semibold text-xs ${currentClosed ? 'text-brand-red italic' : 'text-white'}`}>
                          {getDisplayHours(entry)}
                        </span>
                      )}
                    </td>

                    {/* Obsada główna */}
                    <td className="py-3 px-4">
                      {isManagerOrOwner ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-[#555] uppercase tracking-wider w-8 font-bold">Lead:</span>
                            <select
                              value={entry.leadUserId || ''}
                              onChange={(e) => handleCellChange(entry.date, 'leadUserId', e.target.value)}
                              className="px-2 py-1 bg-[#1e1e1e] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-brand-gold"
                            >
                              <option value="">-- Brak --</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-[#555] uppercase tracking-wider w-8 font-bold">Supp:</span>
                            <select
                              value={entry.supportUserId || ''}
                              onChange={(e) => handleCellChange(entry.date, 'supportUserId', e.target.value)}
                              className="px-2 py-1 bg-[#1e1e1e] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-brand-gold"
                            >
                              <option value="">-- Brak --</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <div>
                            <span className="text-[#666] font-medium mr-1">Prowadzący:</span>
                            <span className="font-semibold text-white">{entry.leadName || <span className="text-[#444] italic">Nie obsadzono</span>}</span>
                          </div>
                          <div>
                            <span className="text-[#666] font-medium mr-1">Wspomagający:</span>
                            <span className="font-semibold text-[#a0a0a0]">{entry.supportName || <span className="text-[#444] italic">Nie obsadzono</span>}</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Wydarzenie specjalne */}
                    <td className="py-3 px-4">
                      {isManagerOrOwner ? (
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                          <input
                            type="text"
                            value={entry.eventRemarks || ''}
                            onChange={(e) => handleCellChange(entry.date, 'eventRemarks', e.target.value)}
                            placeholder="np. Urodziny Bartka 14:00"
                            className="w-full px-2 py-1 bg-[#1e1e1e] border border-white/10 rounded text-xs text-white placeholder-white/20 focus:outline-none focus:border-brand-gold"
                          />
                          {entry.eventRemarks && (
                            <div className="flex flex-col border border-white/5 bg-[#141414] rounded-md p-1.5 max-h-20 overflow-y-auto space-y-1">
                              <div className="text-[9px] text-[#555] uppercase font-bold tracking-wider mb-1">Przypisz obsługę:</div>
                              {employees.map(emp => {
                                const isChecked = assignedUserIds.includes(emp.id);
                                return (
                                  <label key={emp.id} className="flex items-center gap-1.5 text-[11px] text-[#a0a0a0] hover:text-white cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => toggleEventUser(emp.id, e.target.checked)}
                                      className="w-3 h-3 accent-brand-gold bg-[#1e1e1e] border-white/10 rounded"
                                    />
                                    <span>{emp.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        entry.eventRemarks ? (
                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-brand-gold">{entry.eventRemarks}</div>
                            <div className="text-[10px] text-[#666] flex items-center gap-1">
                              <span>Obsługa:</span>
                              {entry.eventUserIds ? (
                                <span className="font-semibold text-white">
                                  {entry.eventUserIds.split(',').map(id => {
                                    const emp = employees.find(e => e.id === Number(id));
                                    return emp ? emp.name : '';
                                  }).filter(Boolean).join(', ')}
                                </span>
                              ) : (
                                <span className="text-brand-gold/70 italic">
                                  {entry.leadName || entry.supportName ? (
                                    `Domyślnie (${[entry.leadName, entry.supportName].filter(Boolean).join(', ')})`
                                  ) : (
                                    'Brak obsady'
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#444] italic text-xs">—</span>
                        )
                      )}
                    </td>

                    {/* Uwagi */}
                    <td className="py-3 px-4">
                      {isManagerOrOwner ? (
                        <input
                          type="text"
                          value={entry.remarks || ''}
                          onChange={(e) => handleCellChange(entry.date, 'remarks', e.target.value)}
                          placeholder="Dodaj uwagi..."
                          className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-brand-gold"
                        />
                      ) : (
                        <span className="text-xs text-[#888]">
                          {entry.remarks || '—'}
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend Block */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold uppercase text-[#a0a0a0] tracking-wider font-display">System Powiadomień</h4>
          <p className="text-[11px] text-[#888]">
            Każda modyfikacja grafiku przez Menedżera automatycznie wysyła powiadomienie do zainteresowanych pracowników.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Grafik jest zsynchronizowany w czasie rzeczywistym</span>
        </div>
      </div>
    </div>
  );
}
