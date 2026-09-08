'use client';

import { useState, useEffect } from 'react';
import { getUserSessionsAction, invalidateOtherSessionsAction } from '@/app/actions/securityActions';

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    const res = await getUserSessionsAction();
    if (res.success && res.data) {
      setSessions(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeOthers = async () => {
    if (!confirm('Czy na pewno chcesz wylogować wszystkie pozostałe urządzenia?')) return;
    const res = await invalidateOtherSessionsAction();
    if (res.success) {
      setMsg('Wszystkie pozostałe sesje zostały odwołane.');
      loadSessions();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md">
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <span>🛡️</span> Bezpieczeństwo & Aktywne Urządzenia
        </h1>
        <p className="text-sm text-slate-400">
          Zarządzaj aktywnymi sesjami oraz bezpieczeństwem konta
        </p>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-xl text-sm font-semibold">
          {msg}
        </div>
      )}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Aktywne Sesje i Urządzenia</h2>
            <p className="text-xs text-slate-400">Lista urządzeń z zalogowanym kontem</p>
          </div>
          <button
            onClick={handleRevokeOthers}
            className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold px-4 py-2 rounded-xl text-xs transition"
          >
            Wyloguj wszystkie pozostałe urządzenia
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400">Ładowanie aktywnych sesji...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6 text-slate-400">Brak zarejestrowanych dodatkowych sesji.</div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-200">{s.userAgent || 'Przeglądarka internetowa'}</p>
                  <p className="text-slate-500">IP: {s.ipAddress || 'Zarejestrowane'} • Wygaśnie: {new Date(s.expiresAt).toLocaleDateString()}</p>
                </div>
                <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-full font-bold">Aktywna</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
