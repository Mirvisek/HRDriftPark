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
  const handleCellChange = async (dateStr: string, field: 'leadUserId' | 'supportUserId' | 'remarks', value: any) => {
    const updated = scheduleList.map(item => {
      if (item.date === dateStr) {
        let nameField = '';
        if (field === 'leadUserId') {
          const emp = employees.find(e => e.id === Number(value));
          return { ...item, leadUserId: value ? Number(value) : null, leadName: emp ? emp.name : undefined };
        } else if (field === 'supportUserId') {
          const emp = employees.find(e => e.id === Number(value));
          return { ...item, supportUserId: value ? Number(value) : null, supportName: emp ? emp.name : undefined };
        } else {
          return { ...item, remarks: value };
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
        targetItem.remarks
      );
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zapisano zmiany w grafiku i powiadomiono pracowników dla dnia ${dateStr}.` });
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
                <th className="py-4 px-6">Dzień</th>
                <th className="py-4 px-6">Dzień Tygodnia</th>
                <th className="py-4 px-6">Osoba Prowadząca</th>
                <th className="py-4 px-6">Osoba Wspomagająca</th>
                <th className="py-4 px-6">Uwagi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#121212]">
              {scheduleList.map((entry) => {
                const dayNum = new Date(entry.date).getDate();
                const dayName = getDayName(entry.date);
                const isWeekend = dayName === 'Sobota' || dayName === 'Niedziela';

                return (
                  <tr
                    key={entry.date}
                    className={`hover:bg-[#1a1a1a] transition ${isWeekend ? 'bg-brand-gold/[0.01]' : ''}`}
                  >
                    <td className="py-3 px-6 font-bold text-white text-md">
                      {dayNum}
                    </td>
                    <td className={`py-3 px-6 text-xs font-semibold ${isWeekend ? 'text-brand-gold' : 'text-[#a0a0a0]'}`}>
                      {dayName}
                    </td>

                    {/* Osoba Prowadząca */}
                    <td className="py-3 px-6">
                      {isManagerOrOwner ? (
                        <select
                          value={entry.leadUserId || ''}
                          onChange={(e) => handleCellChange(entry.date, 'leadUserId', e.target.value)}
                          className="px-3 py-1.5 bg-[#1e1e1e] border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-brand-gold"
                        >
                          <option value="">-- Brak --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-white">
                          {entry.leadName || <span className="text-[#555] italic">Nie obsadzono</span>}
                        </span>
                      )}
                    </td>

                    {/* Osoba Wspomagająca */}
                    <td className="py-3 px-6">
                      {isManagerOrOwner ? (
                        <select
                          value={entry.supportUserId || ''}
                          onChange={(e) => handleCellChange(entry.date, 'supportUserId', e.target.value)}
                          className="px-3 py-1.5 bg-[#1e1e1e] border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-brand-gold"
                        >
                          <option value="">-- Brak --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-[#a0a0a0]">
                          {entry.supportName || <span className="text-[#555] italic">Nie obsadzono</span>}
                        </span>
                      )}
                    </td>

                    {/* Uwagi */}
                    <td className="py-3 px-6">
                      {isManagerOrOwner ? (
                        <input
                          type="text"
                          value={entry.remarks || ''}
                          onChange={(e) => handleCellChange(entry.date, 'remarks', e.target.value)}
                          placeholder="Dodaj uwagi..."
                          className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-white/10 rounded-md text-xs text-white placeholder-white/20 focus:outline-none focus:border-brand-gold"
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
