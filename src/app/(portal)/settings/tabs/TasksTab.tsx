'use client';

import { useState, useEffect } from 'react';
import { 
  Check, 
  AlertCircle,
  Plus,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import { 
  getTaskTemplatesAction, 
  saveTaskTemplateAction, 
  deleteTaskTemplateAction 
} from '@/app/actions/taskActions';

export default function TasksTab() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateDay, setNewTemplateDay] = useState<number>(1);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const templatesRes = await getTaskTemplatesAction();
        if (templatesRes && templatesRes.success) setTemplatesList(templatesRes.data || []);
      } catch (err) {
        console.error("Błąd ładowania szablonów:", err);
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
<div className="space-y-6 animate-fadeIn">
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-fadeIn ${
          statusMsg.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
        }`}>
          {statusMsg.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

          <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden bg-white/[0.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-gold" />
              <span>Dodaj stałe zadanie do szablonu</span>
            </h4>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newTemplateTitle.trim()) return;
              setActionLoading(true);
              try {
                const res = await saveTaskTemplateAction(newTemplateTitle, newTemplateDay);
                if (res.success) {
                  setNewTemplateTitle('');
                  const templatesRes = await getTaskTemplatesAction();
                  if (templatesRes.success) setTemplatesList(templatesRes.data || []);
                  setStatusMsg({ type: 'success', text: 'Dodano szablon zadania pomyślnie.' });
                } else {
                  setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu szablonu.' });
                }
              } catch (err) {
                setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
              } finally {
                setActionLoading(false);
              }
            }} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Treść zadania</label>
                <input
                  type="text"
                  required
                  value={newTemplateTitle}
                  onChange={e => setNewTemplateTitle(e.target.value)}
                  placeholder="np. Sprawdzić ciśnienie w oponach gokartów"
                  className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Dzień tygodnia</label>
                <select
                  value={newTemplateDay}
                  onChange={e => setNewTemplateDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                >
                  <option value={1}>Poniedziałek</option>
                  <option value={2}>Wtorek</option>
                  <option value={3}>Środa</option>
                  <option value={4}>Czwartek</option>
                  <option value={5}>Piątek</option>
                  <option value={6}>Sobota</option>
                  <option value={0}>Niedziela</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2 shrink-0 h-[38px] md:h-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Dodaj szablon</span>
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2 text-[#a0a0a0] font-bold uppercase tracking-wider">
                    <th className="p-4 w-[20%]">Dzień tygodnia</th>
                    <th className="p-4 w-[65%]">Zadanie stałe (poza ruchem)</th>
                    <th className="p-4 text-right w-[15%]">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#121212]">
                  {templatesList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-xs text-[#555] italic">
                        Brak zdefiniowanych szablonów zadań stałych. Dodaj pierwsze zadanie powyżej.
                      </td>
                    </tr>
                  ) : (
                    templatesList.map(t => {
                      const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
                      return (
                        <tr key={t.id} className="hover:bg-white/2 transition">
                          <td className="p-4 font-bold text-white font-mono">
                            {days[t.dayOfWeek]}
                          </td>
                          <td className="p-4 text-[#e0e0e0] font-semibold text-xs">
                            {t.title}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={async () => {
                                if (!confirm('Czy na pewno chcesz usunąć to zadanie z szablonu?')) return;
                                const res = await deleteTaskTemplateAction(t.id);
                                if (res.success) {
                                  setTemplatesList(prev => prev.filter(item => item.id !== t.id));
                                  setStatusMsg({ type: 'success', text: 'Usunięto szablon zadania.' });
                                } else {
                                  setStatusMsg({ type: 'error', text: res.error || 'Błąd usuwania szablonu.' });
                                }
                              }}
                              className="p-1.5 hover:bg-brand-red/10 text-[#555] hover:text-brand-red rounded-lg transition cursor-pointer"
                              title="Usuń szablon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
  );
}
