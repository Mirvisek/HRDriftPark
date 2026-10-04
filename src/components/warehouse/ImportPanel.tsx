'use client';

import { X } from 'lucide-react';
import type { StatusMessage } from './types';

type ImportPanelProps = {
  open: boolean;
  importPreview: any[];
  importStatus: StatusMessage | null;
  actionLoading: boolean;
  onClose: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExecuteImport: () => void;
};

export function ImportPanel({
  open,
  importPreview,
  importStatus,
  actionLoading,
  onClose,
  onFileChange,
  onExecuteImport,
}: ImportPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card max-w-4xl w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-brand-gold to-green-500" />

        <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📥 Import katalogu z Excela / CSV</span>
          </h3>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 scrollbar-thin pr-1">
          <div className="p-4 bg-white/2 rounded-xl border border-white/5 space-y-3">
            <p className="text-xs text-[#a0a0a0] leading-relaxed">
              Możesz zaimportować produkty masowo z pliku Excel (<code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.xlsx</code>, <code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.xls</code>) lub <code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.csv</code>. System dopasuje kolumny automatycznie na podstawie nagłówków.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] bg-[#141414] p-3 rounded-lg border border-white/5 font-mono text-[#777]">
              <div><span className="text-white font-bold">Nazwa</span> (wymagane)</div>
              <div><span className="text-white font-bold">Kategoria</span> (wymagane)</div>
              <div><span className="text-[#a0a0a0]">Jednostka</span> (np. szt.)</div>
              <div><span className="text-[#a0a0a0]">Dostawca</span></div>
              <div><span className="text-[#a0a0a0]">SKU</span></div>
              <div><span className="text-[#a0a0a0]">Lokalizacja</span> (półka)</div>
              <div><span className="text-[#a0a0a0]">Stan początkowy</span></div>
              <div><span className="text-[#a0a0a0]">Min / Max stan</span></div>
            </div>
          </div>

          {/* Input pliku */}
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:border-brand-gold/40 transition bg-[#121212]/50 relative group">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={onFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <span className="text-2xl mb-1">📁</span>
            <span className="text-xs text-[#a0a0a0] font-semibold group-hover:text-brand-gold transition">Wybierz plik Excel lub przeciągnij go tutaj</span>
            <span className="text-[10px] text-[#555] mt-1 font-mono">xlsx, csv</span>
          </div>

          {importStatus && (
            <div className={`p-3 rounded-lg border text-xs font-bold ${
              importStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
            }`}>
              {importStatus.text}
            </div>
          )}

          {/* Podgląd przed importem */}
          {importPreview.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Podgląd danych ({importPreview.length} wierszy)</h4>
              <div className="border border-white/5 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-[#888] font-bold">
                      <th className="p-2">Nazwa</th>
                      <th className="p-2">Kategoria</th>
                      <th className="p-2 text-center">Jedn.</th>
                      <th className="p-2 text-right">Stan pocz.</th>
                      <th className="p-2">Dostawca</th>
                      <th className="p-2">Lokalizacja</th>
                      <th className="p-2 text-center">Ważność</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[#a0a0a0] bg-white/[0.01]">
                    {importPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/2">
                        <td className="p-2 text-white font-semibold truncate max-w-[150px]" title={item.name}>{item.name}</td>
                        <td className="p-2 truncate max-w-[100px]" title={item.categoryName}>{item.categoryName}</td>
                        <td className="p-2 text-center">{item.unit}</td>
                        <td className="p-2 text-right font-bold text-white">{item.initialStock}</td>
                        <td className="p-2 truncate max-w-[100px]">{item.supplier || '-'}</td>
                        <td className="p-2 truncate max-w-[100px]">{item.location || '-'}</td>
                        <td className="p-2 text-center">{item.hasExpiry ? 'TAK' : 'NIE'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#141414] hover:bg-[#222] border border-white/5 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
          >
            Zamknij
          </button>
          {importPreview.length > 0 && (
            <button
              type="button"
              onClick={onExecuteImport}
              disabled={actionLoading}
              className="px-5 py-2 bg-brand-gold hover:bg-yellow-500 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
            >
              {actionLoading ? 'Trwa import...' : `Zatwierdź i Dodaj (${importPreview.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
