'use client';

import { useState, useEffect } from 'react';
import { getOwnerAnalyticsAction } from '@/app/actions/analyticsActions';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getOwnerAnalyticsAction();
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <span>📊</span> Executive Dashboard (Analityka Właściciela)
          </h1>
          <p className="text-sm text-slate-400">
            Kluczowe wskaźniki efektywności finansowej, koszty pracy i rentowność toru
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Ładowanie wskaźników executive...</div>
      ) : !data ? (
        <div className="text-center py-12 text-slate-400">Brak danych analitycznych.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Przychód Całkowity</span>
            <div className="text-3xl font-extrabold text-amber-400">{data.totalRevenue} PLN</div>
            <p className="text-xs text-slate-500">Suma z raportów fiskalnych i kasy</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koszt Pracy (Payroll)</span>
            <div className="text-3xl font-extrabold text-rose-400">{data.totalLaborCost} PLN</div>
            <p className="text-xs text-slate-500">Udział w przychodzie: <span className="font-bold text-amber-400">{data.laborCostPercentage}%</span></p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gotówka w Woreczku</span>
            <div className="text-3xl font-extrabold text-emerald-400">{data.totalCashToBag} PLN</div>
            <p className="text-xs text-slate-500">Rozliczona gotówka z kasy</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suma Produktów w Magazynie</span>
            <div className="text-3xl font-extrabold text-indigo-400">{data.totalStockQuantity} szt.</div>
            <p className="text-xs text-slate-500">Wszystkie aktywne partie towarowe</p>
          </div>
        </div>
      )}
    </div>
  );
}
