'use client';

import { Lock } from 'lucide-react';
import { exportDatabaseBackupAction } from '@/app/actions/settingsActions';

export default function BackupTab() {
  return (
<div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-gold" />
              <span>Kopia Zapasowa Bazy Danych</span>
            </h3>
            <p className="text-xs text-[#a0a0a0]">
              Pobierz pełną kopię zapasową danych z tabel pracowników, grafików, kart pracy, magazynu oraz ustawień do pliku w formacie JSON.
            </p>
            <button
              onClick={async () => {
                const res = await exportDatabaseBackupAction();
                if (res.success && res.json) {
                  const blob = new Blob([res.json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `DriftPark_Backup_${new Date().toISOString().split('T')[0]}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                } else {
                  alert(res.error || 'Błąd generowania kopii zapasowej.');
                }
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-gold to-yellow-600 text-brand-dark font-extrabold text-xs rounded-xl hover:opacity-95 transition flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-gold/10"
            >
              <span>Pobierz Kopię Zapasową (JSON)</span>
            </button>
          </div>
        </div>
  );
}
