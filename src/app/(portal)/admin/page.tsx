'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getAllTimesheets, TimesheetEntry } from '@/app/actions/timesheetActions';
import { checkConflicts } from '@/lib/timesheetUtils';
import { getEmployees, UserEntry } from '@/app/actions/userActions';
import { LayoutDashboard, Users, AlertTriangle, ShieldCheck, Clock, Calendar } from 'lucide-react';

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const currentUser = session?.user ? {
    role: (session.user as any).role || 'employee',
  } : null;

  const isManagerOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'manager';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [allEntries, setAllEntries] = useState<TimesheetEntry[]>([]);
  const [employees, setEmployees] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflictDates, setConflictDates] = useState<string[]>([]);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12
  const monthStr = String(month).padStart(2, '0');

  const monthNames = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  // Pobierz listę pracowników
  useEffect(() => {
    getEmployees().then((res: any) => {
      if (res.success) setEmployees(res.data);
    });
  }, []);

  const fetchAllData = async () => {
    if (!isManagerOrOwner) return;
    setLoading(true);
    const res = await getAllTimesheets(year, month);
    if (res.success) {
      setAllEntries(res.data);
      
      // Sprawdzanie konfliktów na poziomie poszczególnych pracowników
      // Grupa wpisów na pracownika, a potem detekcja konfliktów
      const userEntriesMap: Record<number, TimesheetEntry[]> = {};
      res.data.forEach((entry: TimesheetEntry) => {
        if (!userEntriesMap[entry.userId]) userEntriesMap[entry.userId] = [];
        userEntriesMap[entry.userId].push(entry);
      });

      const allConflicts: string[] = [];
      Object.values(userEntriesMap).forEach(userEntries => {
        const userConflicts = checkConflicts(userEntries);
        allConflicts.push(...userConflicts);
      });
      
      setConflictDates([...new Set(allConflicts)]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, [currentDate]);

  if (!isManagerOrOwner) {
    return (
      <div className="p-8 text-center text-brand-red font-bold">
        Brak uprawnień do przeglądania tej sekcji.
      </div>
    );
  }

  // Obliczenia podsumowań dla pracowników
  const employeeSummaries = employees.map(emp => {
    const empEntries = allEntries.filter(entry => entry.userId === emp.id);
    let totalMinutes = 0;
    empEntries.forEach(entry => {
      const [sh, sm] = entry.startTime.split(':').map(Number);
      const [eh, em] = entry.endTime.split(':').map(Number);
      totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
    });
    const hasConflicts = empEntries.some(e => conflictDates.includes(e.date));

    return {
      ...emp,
      totalHours: (totalMinutes / 60).toFixed(2),
      entriesCount: empEntries.length,
      hasConflicts
    };
  });

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
            PANEL <span className="text-brand-red">MENEDŻERA</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Zestawienie czasu pracy zespołu, wykrywanie konfliktów oraz statystyki.
          </p>
        </div>

        <div className="flex bg-[#0a0a0a] border border-white/10 rounded-lg p-1">
          <button onClick={prevMonth} className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer">←</button>
          <span className="px-4 py-1 text-xs font-bold text-white flex items-center">{monthNames[month]} {year}</span>
          <button onClick={nextMonth} className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer">→</button>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white font-display">{employees.length}</div>
            <div className="text-xs text-[#a0a0a0]">Aktywnych pracowników</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold border border-brand-gold/10">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white font-display">
              {employeeSummaries.reduce((sum, e) => sum + Number(e.totalHours), 0).toFixed(2)}h
            </div>
            <div className="text-xs text-[#a0a0a0]">Przepracowanych łącznie</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 flex items-center gap-4 border border-brand-red/10 bg-brand-red/5">
          <div className="w-12 h-12 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red border border-brand-red/10">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-white font-display">{conflictDates.length}</div>
            <div className="text-xs text-[#a0a0a0]">Dni z konfliktami godzinowymi</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Employee Summaries */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-md font-bold text-white font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-gold" />
              <span>Czas pracy pracowników</span>
            </h3>

            <div className="divide-y divide-white/5 space-y-3">
              {employeeSummaries.map(emp => (
                <div key={emp.id} className="pt-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>{emp.name}</span>
                      {emp.hasConflicts && (
                        <span className="px-1.5 py-0.5 rounded bg-brand-red/20 text-brand-red text-[8px] font-extrabold uppercase animate-pulse">
                          Konflikt
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#a0a0a0]">{emp.position}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-white text-sm">{emp.totalHours}h</div>
                    <div className="text-[9px] text-[#555]">{emp.entriesCount} wpisów</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detailed Logs & Conflicts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-md font-bold text-white font-display flex items-center gap-2 mb-6">
              <Calendar className="w-4 h-4 text-brand-red" />
              <span>Rejestr dzienny & Weryfikacja konfliktów</span>
            </h3>

            {/* List of days with active logs */}
            <div className="space-y-4">
              {allEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#555] italic">
                  Brak wpisów ewidencji godzinowej w tym miesiącu.
                </div>
              ) : (
                // Group entries by date
                Object.entries(
                  allEntries.reduce((group, entry) => {
                    if (!group[entry.date]) group[entry.date] = [];
                    group[entry.date].push(entry);
                    return group;
                  }, {} as Record<string, TimesheetEntry[]>)
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateStr, dayEntries]) => {
                    const isConflict = conflictDates.includes(dateStr);
                    const typedDayEntries = dayEntries as TimesheetEntry[];
                    return (
                      <div
                        key={dateStr}
                        className={`p-4 rounded-xl border transition ${
                          isConflict 
                            ? 'bg-brand-red/10 border-brand-red/30 text-brand-red shadow-[0_0_12px_rgba(255,51,51,0.1)]' 
                            : 'bg-[#161616] border-white/5 text-[#e0e0e0]'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2.5">
                          <span className="text-xs font-extrabold uppercase tracking-wide">
                            {dateStr}
                          </span>
                          {isConflict ? (
                            <span className="px-2 py-0.5 rounded bg-brand-red text-white text-[9px] font-black uppercase flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Błąd: Nakładanie zmian!</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-black uppercase flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Brak Kolizji</span>
                            </span>
                          )}
                        </div>

                        {/* Shifts for this day */}
                        <div className="space-y-2">
                          {typedDayEntries.map((e: any) => (
                            <div
                              key={e.id}
                              className="bg-[#0f0f0f] border border-white/5 rounded-lg p-2.5 flex justify-between items-center text-xs"
                            >
                              <div>
                                <div className="font-bold text-white">{e.userName}</div>
                                <div className="text-[10px] text-[#888]">{e.remarks || '—'}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-semibold text-brand-gold text-[11px]">
                                  {e.startTime} - {e.endTime}
                                </div>
                                <div className="text-[9px] text-[#555]">
                                  ({( ((Number(e.endTime.split(':')[0]) * 60 + Number(e.endTime.split(':')[1])) - (Number(e.startTime.split(':')[0]) * 60 + Number(e.startTime.split(':')[1])) ) / 60).toFixed(2)}h)
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
