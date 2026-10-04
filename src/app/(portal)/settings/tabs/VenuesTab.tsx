'use client';

import { useState, useEffect } from 'react';
import { 
  Check, 
  AlertCircle,
  Building,
} from 'lucide-react';
import { 
  getVenuesAction,
  saveVenueAction,
  deleteVenueAction,
} from '@/app/actions/settingsActions';

export default function VenuesTab() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [venuesList, setVenuesList] = useState<any[]>([]);
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [venueColor, setVenueColor] = useState('#ffd700');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const venuesRes = await getVenuesAction();
        if (venuesRes && venuesRes.success) setVenuesList(venuesRes.venues || []);
      } catch (err) {
        console.error("Błąd ładowania lokali:", err);
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formularz dodawania/edycji lokalu */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 h-fit relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-gold" />
                <span>{editingVenueId ? 'Edycja lokalu' : 'Dodaj nowy lokal'}</span>
              </h3>
              
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newVenueName.trim()) return;
                  setActionLoading(true);
                  try {
                    const res = await saveVenueAction(editingVenueId, newVenueName, venueColor);
                    if (res.success) {
                      setStatusMsg({ type: 'success', text: editingVenueId ? 'Zaktualizowano dane lokalu.' : 'Dodano nowy lokal.' });
                      setNewVenueName('');
                      setVenueColor('#ffd700');
                      setEditingVenueId(null);
                      const vRes = await getVenuesAction();
                      if (vRes.success) setVenuesList(vRes.venues || []);
                    } else {
                      setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu lokalu.' });
                    }
                  } catch (err: any) {
                    setStatusMsg({ type: 'error', text: err.message });
                  } finally {
                    setActionLoading(false);
                    setTimeout(() => setStatusMsg(null), 4000);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Nazwa lokalu</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Tarnów, Warszawa"
                    value={newVenueName}
                    onChange={e => setNewVenueName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-brand-gold hover:opacity-95 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    {editingVenueId ? 'Zapisz' : 'Dodaj'}
                  </button>
                  {editingVenueId && (
                    <button
                      type="button"
                      onClick={() => { setEditingVenueId(null); setNewVenueName(''); }}
                      className="px-4 py-2 bg-[#222] text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Tabela lokali */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Lista Lokali</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                      <th className="pb-3 w-[10%]">ID</th>
                      <th className="pb-3 w-[45%]">Nazwa lokalu</th>
                      <th className="pb-3 w-[25%]">Utworzono</th>
                      <th className="pb-3 text-right w-[20%]">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                    {venuesList.map(v => (
                      <tr key={v.id} className="hover:bg-white/2 transition">
                        <td className="py-3 font-mono text-[#555]">{v.id}</td>
                        <td className="py-3 font-bold text-white">
                          {v.name} {v.id === 1 && <span className="text-[10px] text-brand-gold font-normal italic ml-1">(Domyślny)</span>}
                        </td>
                        <td className="py-3 text-[#666]">
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString('pl-PL') : '-'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingVenueId(v.id); setNewVenueName(v.name); }}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase rounded cursor-pointer transition border border-white/5"
                            >
                              Edytuj
                            </button>
                            {v.id !== 1 && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Czy na pewno chcesz usunąć lokal "${v.name}"?`)) return;
                                  setActionLoading(true);
                                  try {
                                    const res = await deleteVenueAction(v.id);
                                    if (res.success) {
                                      setStatusMsg({ type: 'success', text: 'Usunięto lokal.' });
                                      const vRes = await getVenuesAction();
                                      if (vRes.success) setVenuesList(vRes.venues || []);
                                    } else {
                                      setStatusMsg({ type: 'error', text: res.error || 'Błąd usuwania lokalu.' });
                                    }
                                  } catch (err: any) {
                                    setStatusMsg({ type: 'error', text: err.message });
                                  } finally {
                                    setActionLoading(false);
                                    setTimeout(() => setStatusMsg(null), 4000);
                                  }
                                }}
                                className="px-2 py-1 bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/20 text-brand-red text-[10px] font-bold uppercase rounded cursor-pointer transition"
                              >
                                Usuń
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
  );
}
