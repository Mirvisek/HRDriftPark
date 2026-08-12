'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Check, CheckCircle2, ClipboardCheck, Clock, Flag, MinusCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { ChecklistItemStatus, ChecklistType, getChecklistAction, updateChecklistItemAction } from '@/app/actions/checklistActions';

type ChecklistItem = {
  id: number;
  title: string;
  section: string;
  dueMinutesBeforeClose: number | null;
  status: ChecklistItemStatus;
  note: string | null;
  completedByName: string | null;
  completedAt: Date | string | null;
};

const statusStyle: Record<ChecklistItemStatus, string> = {
  pending: 'border-white/10 bg-white/[0.015]',
  completed: 'border-green-500/25 bg-green-500/[0.06]',
  not_applicable: 'border-white/10 bg-white/[0.02] opacity-70',
  problem: 'border-brand-red/40 bg-brand-red/[0.08]',
};

export default function ChecklistsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<ChecklistType>('opening');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteItem, setNoteItem] = useState<ChecklistItem | null>(null);
  const [note, setNote] = useState('');
  const [targetStatus, setTargetStatus] = useState<ChecklistItemStatus>('problem');

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await getChecklistAction(date, type);
    if (result.success) setItems((result.data || []) as ChecklistItem[]);
    else setError(result.error || 'Nie udało się wczytać checklisty.');
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void getChecklistAction(date, type).then(result => {
      if (!active) return;
      if (result.success) setItems((result.data || []) as ChecklistItem[]);
      else setError(result.error || 'Nie udało się wczytać checklisty.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [date, type]);

  const completed = items.filter(item => item.status !== 'pending').length;
  const problems = items.filter(item => item.status === 'problem').length;
  const sections = useMemo(() => Array.from(new Set(items.map(item => item.section))), [items]);

  const saveStatus = async (item: ChecklistItem, status: ChecklistItemStatus, itemNote = item.note || '') => {
    setSavingId(item.id);
    setError(null);
    const result = await updateChecklistItemAction(item.id, status, itemNote);
    if (result.success) {
      const now = new Date().toISOString();
      setItems(previous => previous.map(current => current.id === item.id ? {
        ...current, status, note: itemNote || null,
        completedAt: status === 'pending' ? null : now,
      } : current));
    } else setError(result.error || 'Nie udało się zapisać statusu.');
    setSavingId(null);
  };

  const setStatus = (item: ChecklistItem, status: ChecklistItemStatus) => {
    if (status === 'problem' || (status === 'not_applicable' && item.note)) {
      setNoteItem(item); setNote(item.note || ''); setTargetStatus(status); return;
    }
    saveStatus(item, status);
  };

  const formatDue = (minutes: number | null) => {
    if (minutes === null) return null;
    return minutes === 0 ? 'na zamknięcie' : `${minutes} min przed`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
            CHECKLISTY <span className="text-brand-gold">ZMIANY</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">Wykonuj czynności otwarcia i zamknięcia. Problemy wymagają opisu.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-gold" />
          <input type="date" value={date} onChange={event => setDate(event.target.value)} className="px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-brand-gold" />
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
        {(['opening', 'closing'] as ChecklistType[]).map(tab => (
          <button key={tab} onClick={() => setType(tab)} className={`py-3 text-xs font-extrabold uppercase tracking-wider transition ${type === tab ? 'bg-brand-gold text-[#111]' : 'text-[#888] hover:text-white'}`}>
            {tab === 'opening' ? 'Otwarcie lokalu' : 'Zamknięcie lokalu'}
          </button>
        ))}
      </div>

      {error && <div className="p-3 border border-brand-red/30 bg-brand-red/10 text-brand-red rounded-xl text-xs flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      <section className="glass-card border border-white/10 rounded-2xl p-5 flex flex-wrap gap-5 items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-brand-gold" />
          <div><p className="text-sm font-bold text-white">{type === 'opening' ? 'Otwarcie lokalu' : 'Zamknięcie lokalu'}</p><p className="text-[11px] text-[#888]">{completed} z {items.length} pozycji oznaczonych</p></div>
        </div>
        <div className="flex items-center gap-3">
          {problems > 0 && <span className="text-[11px] font-bold text-brand-red flex items-center gap-1"><TriangleAlert className="w-4 h-4" /> Problemy: {problems}</span>}
          <button onClick={load} className="p-2 text-[#888] hover:text-brand-gold rounded-lg hover:bg-white/5" title="Odśwież"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </section>

      {loading ? <div className="h-48 flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-brand-gold" /></div> : sections.map(section => (
        <section key={section} className="space-y-3">
          <h3 className="text-[11px] font-extrabold text-brand-gold uppercase tracking-wider px-1">{section}</h3>
          {items.filter(item => item.section === section).map(item => (
            <article key={item.id} className={`rounded-xl border p-4 transition ${statusStyle[item.status]}`}>
              <div className="flex gap-3 items-start">
                <button onClick={() => setStatus(item, item.status === 'completed' ? 'pending' : 'completed')} disabled={savingId === item.id} title={item.status === 'completed' ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'} className="mt-0.5 shrink-0 text-brand-gold disabled:opacity-50">
                  {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <span className="w-5 h-5 rounded border-2 border-brand-gold/80 block" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 items-center"><p className={`text-xs font-semibold leading-relaxed ${item.status === 'completed' ? 'line-through text-[#777]' : 'text-white'}`}>{item.title}</p>{formatDue(item.dueMinutesBeforeClose) && <span className="text-[9px] text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3" />{formatDue(item.dueMinutesBeforeClose)}</span>}</div>
                  {item.note && <p className={`text-[11px] mt-2 ${item.status === 'problem' ? 'text-brand-red' : 'text-[#888]'}`}>{item.status === 'problem' && 'Problem: '}{item.note}</p>}
                  {item.completedAt && <p className="text-[10px] text-[#666] mt-2">Oznaczono: {new Date(item.completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}{item.completedByName ? ` · ${item.completedByName}` : ''}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setStatus(item, 'not_applicable')} disabled={savingId === item.id} title="Nie dotyczy" className={`p-1.5 rounded hover:bg-white/10 ${item.status === 'not_applicable' ? 'text-white' : 'text-[#666]'}`}><MinusCircle className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(item, 'problem')} disabled={savingId === item.id} title="Zgłoś problem" className={`p-1.5 rounded hover:bg-brand-red/10 ${item.status === 'problem' ? 'text-brand-red' : 'text-[#666]'}`}><Flag className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}

      {noteItem && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 p-4 flex items-center justify-center"><form onSubmit={event => { event.preventDefault(); saveStatus(noteItem, targetStatus, note); setNoteItem(null); }} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171717] p-6 space-y-4 shadow-2xl"><h3 className="text-base font-bold text-white">{targetStatus === 'problem' ? 'Opisz problem' : 'Dodaj uwagę'}</h3><p className="text-xs text-[#aaa]">{noteItem.title}</p><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} required={targetStatus === 'problem'} placeholder="Np. uszkodzone zapięcie w kasku nr 12" className="w-full min-h-28 p-3 rounded-xl bg-[#0a0a0a] border border-white/10 text-sm text-white focus:outline-none focus:border-brand-gold" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setNoteItem(null)} className="px-4 py-2 text-xs font-bold text-[#aaa]">Anuluj</button><button type="submit" className="px-4 py-2 rounded-lg bg-brand-red text-xs font-extrabold text-white flex items-center gap-1"><Check className="w-4 h-4" />Zapisz</button></div></form></div>}
    </div>
  );
}
