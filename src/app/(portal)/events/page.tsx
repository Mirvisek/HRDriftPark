'use client';

import { useState, useEffect } from 'react';
import { getEventsAction, createOrUpdateEventAction, deleteEventAction, EventData } from '@/app/actions/eventActions';
import { PartyPopper, Plus, Calendar, Clock, Users, DollarSign, Edit, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function EventsPage() {
  const [eventsList, setEventsList] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<EventData>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    const res = await getEventsAction();
    if (res.success && res.data) {
      setEventsList(res.data as EventData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent.title || !editingEvent.customerName || !editingEvent.date) {
      setMessage({ type: 'error', text: 'Tytuł, nazwa klienta oraz data są wymagane.' });
      return;
    }

    const res = await createOrUpdateEventAction(editingEvent as EventData);
    if (res.success) {
      setMessage({ type: 'success', text: 'Zapisano rezerwację eventu.' });
      setShowModal(false);
      setEditingEvent({});
      loadEvents();
    } else {
      setMessage({ type: 'error', text: res.error || 'Błąd zapisu eventu.' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return;
    const res = await deleteEventAction(id);
    if (res.success) {
      loadEvents();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
            <PartyPopper className="w-7 h-7 text-brand-gold" />
            <span>REZERWACJE & <span className="text-brand-gold">EVENTY</span></span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Zarządzaj imprezami urodzinowymi, firmowymi oraz rezerwacjami toru.
          </p>
        </div>
        <button
          onClick={() => { setEditingEvent({ date: new Date().toISOString().split('T')[0], startTime: '16:00', endTime: '18:00', participantsCount: 10, totalAmount: 500, depositPaid: 100 }); setShowModal(true); }}
          className="bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark font-black px-5 py-3 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nowa Rezerwacja Eventu</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-brand-red/10 border-brand-red/20 text-brand-red'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Lista Eventów */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
        </div>
      ) : eventsList.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center text-[#666]">
          <PartyPopper className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm font-bold text-white uppercase tracking-wider">Brak zarejestrowanych rezerwacji i eventów.</p>
          <p className="text-xs text-[#666] mt-1">Kliknij przycisk powyżej, aby dodać pierwszą rezerwację.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventsList.map((ev) => (
            <div key={ev.id} className="glass-card border border-white/5 hover:border-brand-gold/30 rounded-2xl p-5 shadow-lg transition-all space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-md">{ev.title}</h3>
                  <p className="text-xs text-brand-gold font-semibold">{ev.customerName} {ev.customerPhone ? `(${ev.customerPhone})` : ''}</p>
                </div>
                <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${ev.status === 'confirmed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'}`}>
                  {ev.status || 'booked'}
                </span>
              </div>

              <div className="text-xs text-[#a0a0a0] space-y-1.5 bg-[#141414] p-3 rounded-xl border border-white/5 font-mono">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-brand-gold" /> Data & Czas:</span>
                  <span className="font-bold text-white">{ev.date} ({ev.startTime} - {ev.endTime})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-400" /> Uczestnicy:</span>
                  <span className="font-bold text-white">{ev.participantsCount} osób</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-400" /> Kwota / Zaliczka:</span>
                  <span className="font-bold text-green-400">{ev.totalAmount} PLN / <span className="text-brand-gold">{ev.depositPaid} PLN</span></span>
                </div>
              </div>

              {ev.notes && (
                <p className="text-xs text-[#888] italic bg-white/2 p-2.5 rounded-lg border border-white/5">
                  "{ev.notes}"
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => { setEditingEvent(ev); setShowModal(true); }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition cursor-pointer"
                  title="Edytuj"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ev.id!)}
                  className="p-2 bg-brand-red/10 hover:bg-brand-red/20 text-brand-red rounded-lg transition border border-brand-red/20 cursor-pointer"
                  title="Usuń"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edycji/Tworzenia */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-card bg-[#0f0f0f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h2 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-brand-gold" />
                <span>{editingEvent.id ? 'Edycja Rezerwacji' : 'Nowa Rezerwacja Eventu'}</span>
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#666] hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Tytuł Eventu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Urodziny 10 lat - Kacper"
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Imię & Nazwisko Klienta</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.customerName || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, customerName: e.target.value })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Telefon</label>
                  <input
                    type="text"
                    value={editingEvent.customerPhone || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, customerPhone: e.target.value })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={editingEvent.date || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Od (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.startTime || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Do (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.endTime || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Uczestnicy</label>
                  <input
                    type="number"
                    value={editingEvent.participantsCount || 1}
                    onChange={(e) => setEditingEvent({ ...editingEvent, participantsCount: Number(e.target.value) })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Suma (PLN)</label>
                  <input
                    type="number"
                    value={editingEvent.totalAmount || 0}
                    onChange={(e) => setEditingEvent({ ...editingEvent, totalAmount: Number(e.target.value) })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Zaliczka (PLN)</label>
                  <input
                    type="number"
                    value={editingEvent.depositPaid || 0}
                    onChange={(e) => setEditingEvent({ ...editingEvent, depositPaid: Number(e.target.value) })}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider block mb-1">Uwagi / Checklista Eventowa</label>
                <textarea
                  rows={2}
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-[#222] hover:bg-[#333] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-gold to-yellow-500 text-brand-dark font-black rounded-xl text-xs uppercase tracking-wider hover:opacity-95 transition cursor-pointer"
                >
                  Zapisz Rezerwację
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
