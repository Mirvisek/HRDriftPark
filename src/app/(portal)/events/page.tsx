'use client';

import { useState, useEffect } from 'react';
import { getEventsAction, createOrUpdateEventAction, deleteEventAction, EventData } from '@/app/actions/eventActions';

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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <span>🎉</span> Rezerwacje & Eventy
          </h1>
          <p className="text-sm text-slate-400">
            Zarządzaj imprezami urodzinowymi, korporacyjnymi i rezerwacjami toru
          </p>
        </div>
        <button
          onClick={() => { setEditingEvent({ date: new Date().toISOString().split('T')[0], startTime: '16:00', endTime: '18:00', participantsCount: 10, totalAmount: 500, depositPaid: 100 }); setShowModal(true); }}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
        >
          <span>➕</span> Nowa Rezerwacja Eventu
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'}`}>
          {message.text}
        </div>
      )}

      {/* Lista Eventów */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Ładowanie rezerwacji...</div>
      ) : eventsList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <p className="text-lg">Brak zarejestrowanych rezerwacji i eventów.</p>
          <p className="text-sm text-slate-500 mt-1">Kliknij przycisk powyżej, aby dodać pierwszy event.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventsList.map((ev) => (
            <div key={ev.id} className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 shadow-lg transition-all space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-100 text-lg">{ev.title}</h3>
                  <p className="text-xs text-amber-400 font-semibold">{ev.customerName} {ev.customerPhone ? `(${ev.customerPhone})` : ''}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${ev.status === 'confirmed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                  {ev.status || 'booked'}
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-1 bg-slate-950/50 p-3 rounded-xl">
                <div className="flex justify-between">
                  <span>📅 Data & Czas:</span>
                  <span className="font-bold text-slate-100">{ev.date} ({ev.startTime} - {ev.endTime})</span>
                </div>
                <div className="flex justify-between">
                  <span>👥 Uczestnicy:</span>
                  <span className="font-bold text-slate-100">{ev.participantsCount} osób</span>
                </div>
                <div className="flex justify-between">
                  <span>💰 Wartość / Zaliczka:</span>
                  <span className="font-bold text-emerald-400">{ev.totalAmount} PLN / <span className="text-amber-400">{ev.depositPaid} PLN</span></span>
                </div>
              </div>

              {ev.notes && (
                <p className="text-xs text-slate-400 italic bg-slate-800/40 p-2 rounded-lg">
                  "{ev.notes}"
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => { setEditingEvent(ev); setShowModal(true); }}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => handleDelete(ev.id!)}
                  className="text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded-lg font-semibold transition border border-rose-800/50"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edycji/Tworzenia */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-amber-400">
              {editingEvent.id ? 'Edycja Rezerwacji' : 'Nowa Rezerwacja Eventu'}
            </h2>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Tytuł Eventu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Urodziny 10 lat - Kacper"
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Imię & Nazwisko Klienta</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.customerName || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, customerName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Telefon</label>
                  <input
                    type="text"
                    value={editingEvent.customerPhone || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, customerPhone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={editingEvent.date || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Od (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.startTime || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Do (HH:MM)</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.endTime || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Uczestnicy</label>
                  <input
                    type="number"
                    value={editingEvent.participantsCount || 1}
                    onChange={(e) => setEditingEvent({ ...editingEvent, participantsCount: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Suma (PLN)</label>
                  <input
                    type="number"
                    value={editingEvent.totalAmount || 0}
                    onChange={(e) => setEditingEvent({ ...editingEvent, totalAmount: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Zaliczka (PLN)</label>
                  <input
                    type="number"
                    value={editingEvent.depositPaid || 0}
                    onChange={(e) => setEditingEvent({ ...editingEvent, depositPaid: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Uwagi / Checklista Eventowa</label>
                <textarea
                  rows={2}
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition"
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
