'use client';

import { useState, useEffect } from 'react';
import { getAuditLogsAction, purgeOldAuditLogsAction, AuditLogEntry } from '@/app/actions/auditActions';

export default function AuditTab() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getAuditLogsAction();
        if (res.success) setAuditLogs(res.data);
      } catch (err) {
        console.error("Błąd ładowania logów audytu:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
<div className="space-y-6">
          <div className="flex justify-between items-center bg-[#141414] p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Historia Logów Audytu</h3>
              <p className="text-xs text-[#888]">Ostatnie 100 operacji zarejestrowanych w systemie.</p>
            </div>
            <button
              onClick={async () => {
                if (confirm("Czy na pewno chcesz usunąć logi audytowe starsze niż 6 miesięcy?")) {
                  const res = await purgeOldAuditLogsAction(6);
                  if (res.success) {
                    alert("Pomyślnie wyczyszczono stare logi.");
                    const logsRes = await getAuditLogsAction();
                    if (logsRes.success) setAuditLogs(logsRes.data);
                  }
                }
              }}
              className="px-3 py-1.5 bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs font-bold rounded-lg hover:bg-brand-red/20 transition"
            >
              Wyczyszczenie logów &gt; 6 mies.
            </button>
          </div>

          <div className="overflow-x-auto glass-card rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs text-[#e0e0e0]">
              <thead className="bg-[#161616] text-[#888] uppercase text-[10px] font-bold border-b border-white/10">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Wykonawca</th>
                  <th className="p-3">Tabela</th>
                  <th className="p-3">Akcja</th>
                  <th className="p-3">ID Rekordu</th>
                  <th className="p-3">Szczegóły JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#666]">Brak zarejestrowanych logów audytu.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/2">
                      <td className="p-3 font-mono">{log.createdAt ? new Date(log.createdAt).toLocaleString('pl-PL') : '—'}</td>
                      <td className="p-3 font-bold text-white">{log.executorName || `ID ${log.userId || 'System'}`}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded bg-white/5 font-mono text-[10px]">{log.tableName}</span></td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          log.action === 'INSERT' ? 'bg-green-500/10 text-green-400' :
                          log.action === 'UPDATE' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-brand-red/10 text-brand-red'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono">#{log.recordId}</td>
                      <td className="p-3">
                        <button
                          onClick={() => alert(`Stare dane:\n${log.oldData || 'Brak'}\n\nNowe dane:\n${log.newData || 'Brak'}`)}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-brand-gold"
                        >
                          Podgląd Before/After
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
  );
}
