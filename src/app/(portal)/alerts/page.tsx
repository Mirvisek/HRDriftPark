'use client';

import { useState, useEffect } from 'react';
import { getAlertsAction, resolveAlertAction } from '@/app/actions/alertActions';
import Link from 'next/link';

export default function AlertsPage() {
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');

  const loadAlerts = async () => {
    setLoading(true);
    const res = await getAlertsAction(undefined, statusFilter);
    if (res.success && res.data) {
      setAlertsList(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  const handleResolve = async (id: number, actionStatus: 'acknowledged' | 'resolved' | 'dismissed') => {
    const res = await resolveAlertAction(id, actionStatus, 'USER_ACTION', 'Wyjaśniono przez menedżera');
    if (res.success) {
      loadAlerts();
    }
  };

  const getEntityTargetLink = (alertItem: any) => {
    if (alertItem.entityType === 'timesheet') return '/timesheet';
    if (alertItem.entityType === 'cash_reconciliation') return '/today';
    if (alertItem.entityType === 'stock_transfer' || alertItem.entityType === 'inventory') return '/magazyn';
    return '/today';
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <span>🚨</span> Centrum Wyjątków & Alertów
          </h1>
          <p className="text-sm text-slate-400">
            Zarządzaj alertami anomalii RCP, różnicami kasowymi, przestojami i 11h odpoczynkiem
          </p>
        </div>

        {/* Filtr statusu */}
        <div className="flex gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${statusFilter === 'open' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Otwarte
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${statusFilter === 'resolved' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Rozwiązane
          </button>
        </div>
      </div>

      {/* Lista Alertów */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Ładowanie centrum wyjątku...</div>
      ) : alertsList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <p className="text-lg">Brak aktywnych alertów dla wybranego filtru.</p>
          <p className="text-sm text-slate-500 mt-1">Wszystkie operacje przebiegają prawidłowo!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alertsList.map((alt) => (
            <div
              key={alt.id}
              className={`border rounded-2xl p-5 shadow-lg transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                alt.severity === 'critical' || alt.severity === 'high'
                  ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-500'
                  : alt.severity === 'medium'
                  ? 'bg-amber-950/20 border-amber-800/80 hover:border-amber-500'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    alt.severity === 'critical' ? 'bg-rose-600 text-slate-950' : alt.severity === 'high' ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}>
                    {alt.severity}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{alt.ruleCode}</span>
                  <span className="text-xs text-slate-400">• {new Date(alt.createdAt).toLocaleString()}</span>
                </div>

                <h3 className="font-bold text-slate-100 text-base">{alt.title}</h3>
                <p className="text-sm text-slate-300">{alt.message}</p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                <Link
                  href={getEntityTargetLink(alt)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold px-4 py-2 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5"
                >
                  <span>🔍</span> Otwórz Obiekt
                </Link>

                {alt.status === 'open' && (
                  <button
                    onClick={() => handleResolve(alt.id, 'resolved')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow transition"
                  >
                    Rozwiąż Alert
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
