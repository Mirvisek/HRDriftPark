'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getPayrollSummary } from '@/app/actions/timesheetActions';
import { Calendar, DollarSign, User, Briefcase, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

export default function PayrollPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [payrollList, setPayrollList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const monthNames = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];

  const roleNames: Record<string, string> = {
    owner: 'Właściciel',
    manager: 'Menedżer',
    employee: 'Pracownik',
    technik: 'Technik',
  };

  const roleBadges: Record<string, string> = {
    owner: 'bg-red-500/10 text-red-400 border border-red-500/20',
    manager: 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20',
    employee: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    technik: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user) {
      const role = (session.user as any).role;
      if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
        router.push('/timesheet');
        return;
      }
    }
  }, [status, session, router]);

  const loadPayroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPayrollSummary(year, month);
      if (res.success) {
        setPayrollList(res.data || []);
      } else {
        setError(res.error || 'Błąd ładowania zestawienia płac.');
      }
    } catch (e) {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadPayroll();
    }
  }, [currentDate, status]);

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  // Oblicz podsumowanie
  const totalHours = payrollList.reduce((sum, item) => sum + item.totalHours, 0);
  const totalPayout = payrollList.reduce((sum, item) => sum + item.payout, 0);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
            ROZLICZENIA <span className="text-brand-gold">FINANSOWE</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Zestawienie godzin, stawek i szacowanych wynagrodzeń pracowników.
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex bg-[#0a0a0a] border border-white/10 rounded-lg p-1">
          <button
            onClick={prevMonth}
            className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] rounded text-xs font-bold text-white transition cursor-pointer"
          >
            ←
          </button>
          <span className="px-4 py-1 text-xs font-bold text-white flex items-center min-w-[120px] justify-center">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-center">
          <span className="text-xs text-[#a0a0a0] font-bold uppercase tracking-wider mb-1">Liczba pracowników</span>
          <span className="text-3xl font-black text-white font-display">{payrollList.length}</span>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-center">
          <span className="text-xs text-[#a0a0a0] font-bold uppercase tracking-wider mb-1">Wypracowane godziny</span>
          <span className="text-3xl font-black text-brand-gold font-display">{totalHours.toFixed(1)} h</span>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-center bg-green-500/[0.02]">
          <span className="text-xs text-[#a0a0a0] font-bold uppercase tracking-wider mb-1">Suma wypłat (Koszty płac)</span>
          <span className="text-3xl font-black text-green-400 font-display">{totalPayout.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payroll Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#0a0a0a] border-b border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-[#a0a0a0]">
                <tr>
                  <th className="p-4">Pracownik</th>
                  <th className="p-4">Rola / Stanowisko</th>
                  <th className="p-4 text-center">Stawka</th>
                  <th className="p-4 text-center">Łączne Godziny</th>
                  <th className="p-4 text-right">Kwota do wypłaty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#121212]">
                {payrollList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-[#555] italic">
                      Brak danych rozliczeniowych.
                    </td>
                  </tr>
                ) : (
                  payrollList
                    .sort((a, b) => b.payout - a.payout)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-white/2 transition">
                        <td className="p-4 font-bold text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-xs text-brand-gold font-bold">
                            {p.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>{p.name}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${roleBadges[p.role]}`}>
                              {roleNames[p.role]}
                            </span>
                            <span className="text-[#888]">{p.position}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center text-[#e0e0e0] font-semibold font-mono">
                          {p.hourlyRate} PLN/h
                        </td>
                        <td className="p-4 text-center text-[#a0a0a0] font-bold font-mono">
                          {p.totalHours} h
                        </td>
                        <td className="p-4 text-right text-green-400 font-extrabold text-sm font-mono">
                          {p.payout.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
