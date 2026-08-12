'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { ChecklistTemplateInput, ChecklistType, getChecklistTemplateAction, saveChecklistTemplateAction } from '@/app/actions/checklistActions';

export default function ManageChecklistsPage() {
  const { data: session, status } = useSession(); const router = useRouter();
  const [type, setType] = useState<ChecklistType>('opening'); const [items, setItems] = useState<ChecklistTemplateInput[]>([]); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowed = role === 'owner' || role === 'manager' || role === 'technik';
  useEffect(() => { if (status === 'unauthenticated' || (status === 'authenticated' && !allowed)) router.replace('/checklists'); }, [status, allowed, router]);
  useEffect(() => {
    let active = true;
    if (status === 'authenticated' && allowed) {
      void getChecklistTemplateAction(type).then(result => {
        if (!active) return;
        if (result.success) setItems((result.data || []).map(item => ({ id: item.id, title: item.title, section: item.section, dueMinutesBeforeClose: item.dueMinutesBeforeClose })));
        else setMessage(result.error || 'Nie udało się wczytać szablonu.');
      });
    }
    return () => { active = false; };
  }, [type, status, allowed]);
  const update = (index: number, field: keyof ChecklistTemplateInput, value: string) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'dueMinutesBeforeClose' ? (value === '' ? null : Number(value)) : value } : item));
  const save = async () => { setSaving(true); setMessage(''); const result = await saveChecklistTemplateAction(type, items); setSaving(false); setMessage(result.success ? 'Szablon zapisany. Nowe checklisty będą używać tej wersji.' : result.error || 'Błąd zapisu.'); };
  if (status !== 'authenticated' || !allowed) return null;
  return <div className="max-w-5xl mx-auto space-y-6"><div className="flex justify-between gap-4 items-start"><div><Link href="/checklists" className="text-xs text-brand-gold font-bold flex gap-1 items-center mb-3"><ArrowLeft className="w-4 h-4" />Wróć do checklist</Link><h2 className="text-2xl font-extrabold text-white font-display">EDYCJA <span className="text-brand-gold">CHECKLIST</span></h2><p className="text-xs text-[#aaa] mt-1">Zmiany obowiązują dla checklist utworzonych od teraz; wcześniejsze zapisy zostają niezmienione.</p></div><button onClick={save} disabled={saving} className="px-4 py-2.5 bg-brand-gold rounded-lg text-xs font-extrabold text-[#111] flex gap-2"><Save className="w-4 h-4" />{saving ? 'Zapisywanie…' : 'Zapisz szablon'}</button></div><div className="grid grid-cols-2 rounded-xl border border-white/10 overflow-hidden">{(['opening','closing'] as ChecklistType[]).map(tab => <button key={tab} onClick={() => setType(tab)} className={`py-3 text-xs font-bold ${type === tab ? 'bg-brand-gold text-[#111]' : 'text-[#aaa]'}`}>{tab === 'opening' ? 'Otwarcie' : 'Zamknięcie'}</button>)}</div>{message && <p className="p-3 rounded-xl text-xs bg-brand-gold/10 border border-brand-gold/20 text-brand-gold">{message}</p>}<div className="space-y-3">{items.map((item,index) => <div key={`${item.id}-${index}`} className="grid grid-cols-1 md:grid-cols-[auto_1fr_180px_120px_auto] gap-2 items-center rounded-xl border border-white/10 bg-white/[.02] p-3"><GripVertical className="w-4 h-4 text-[#555] hidden md:block" /><input value={item.title} onChange={e => update(index,'title',e.target.value)} placeholder="Treść punktu" className="p-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white" /><input value={item.section} onChange={e => update(index,'section',e.target.value)} placeholder="Sekcja" className="p-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white" />{type === 'closing' ? <input value={item.dueMinutesBeforeClose ?? ''} onChange={e => update(index,'dueMinutesBeforeClose',e.target.value)} type="number" min="0" placeholder="Min przed" className="p-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white" /> : <span className="text-[10px] text-[#666]">Bez czasu</span>}<button onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="p-2 text-[#777] hover:text-brand-red"><Trash2 className="w-4 h-4" /></button></div>)}</div><button onClick={() => setItems(current => [...current, { title: '', section: type === 'opening' ? 'Lokal i stanowisko' : 'Zamknięcie i przekazanie', dueMinutesBeforeClose: null }])} className="w-full py-3 rounded-xl border border-dashed border-brand-gold/30 text-brand-gold text-xs font-bold flex gap-2 justify-center"><Plus className="w-4 h-4" />Dodaj punkt</button></div>;
}
