'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Flame, 
  RotateCcw, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Package, 
  ClipboardCheck, 
  ClipboardList, 
  CalendarDays, 
  ArrowLeft,
  Home,
  ShieldCheck
} from 'lucide-react';
import { 
  getDemoDataAction, 
  toggleDemoChecklistAction, 
  toggleDemoTaskAction, 
  addDemoTaskAction, 
  updateDemoInventoryStockAction, 
  resetDemoStoreAction 
} from '@/app/actions/demoActions';
import { DemoDataSchema } from '@/db/demoDbStore';

export default function DemoPage() {
  const [demoData, setDemoData] = useState<DemoDataSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklists' | 'tasks' | 'inventory'>('overview');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDemoData = async () => {
    setLoading(true);
    const res = await getDemoDataAction();
    if (res.success && res.data) {
      setDemoData(res.data);
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Błąd odczytu bazy demo.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDemoData();
  }, []);

  const handleToggleChecklist = async (id: number) => {
    const res = await toggleDemoChecklistAction(id);
    if (res.success && res.data) {
      setDemoData(res.data);
    }
  };

  const handleToggleTask = async (id: number) => {
    const res = await toggleDemoTaskAction(id);
    if (res.success && res.data) {
      setDemoData(res.data);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const res = await addDemoTaskAction(newTaskTitle);
    if (res.success && res.data) {
      setDemoData(res.data);
      setNewTaskTitle('');
      setStatusMsg({ type: 'success', text: 'Dodano zadanie w plikowej bazie demo!' });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleStockChange = async (productId: number, delta: number) => {
    const res = await updateDemoInventoryStockAction(productId, delta);
    if (res.success && res.data) {
      setDemoData(res.data);
    }
  };

  const handleResetDemo = async () => {
    if (confirm('Czy na pewno chcesz przywrócić fabryczne dane testowe w niezależnej bazie demo?')) {
      const res = await resetDemoStoreAction();
      if (res.success && res.data) {
        setDemoData(res.data);
        setStatusMsg({ type: 'success', text: 'Zresetowano bazę plikową demo do stanu początkowego.' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#e0e0e0] flex flex-col justify-between font-sans">
      {/* BANER INFORMACYJNY DEMO */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-brand-dark px-4 py-2 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-md">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>🎭 100% NIEZALEŻNY TRYB DEMO (Baza plikowa: data/demo-db.json — Zero połączeń z MariaDB)</span>
      </div>

      {/* GÓRNY PASEK NAWIGACJI */}
      <header className="bg-[#1f1f1f] border-b border-white/10 px-4 md:px-8 py-3 flex items-center justify-between shadow-md">
        <Link href="/dashboard" className="text-xs font-bold uppercase text-[#a0a0a0] hover:text-white flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5 transition">
          <ArrowLeft className="w-4 h-4" />
          <span>Powrót do Portalu</span>
        </Link>

        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-brand-gold" />
          <span className="text-sm font-extrabold text-white uppercase tracking-wider font-display">
            DRIFT PARK <span className="text-brand-gold">DEMO</span>
          </span>
        </div>

        <button
          onClick={handleResetDemo}
          className="text-xs font-bold uppercase tracking-wider bg-brand-red/20 hover:bg-brand-red/30 text-brand-red border border-brand-red/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resetuj Dane Demo</span>
        </button>
      </header>

      {/* PASEK ZAKŁADEK */}
      <div className="bg-[#181818] border-b border-white/5 px-4 md:px-8 py-2 flex items-center justify-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview' ? 'bg-brand-gold text-brand-dark font-black' : 'text-[#a0a0a0] hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Przegląd i Grafik</span>
        </button>
        <button
          onClick={() => setActiveTab('checklists')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'checklists' ? 'bg-brand-gold text-brand-dark font-black' : 'text-[#a0a0a0] hover:bg-white/5'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Checklisty ({demoData?.checklists.filter(c => c.status === 'completed').length || 0}/{demoData?.checklists.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'tasks' ? 'bg-brand-gold text-brand-dark font-black' : 'text-[#a0a0a0] hover:bg-white/5'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Zadania Zmiany</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'inventory' ? 'bg-brand-gold text-brand-dark font-black' : 'text-[#a0a0a0] hover:bg-white/5'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Magazyn Demo</span>
        </button>
      </div>

      {/* OBSZAR GŁÓWNY */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 overflow-y-auto space-y-6">
        {statusMsg && (
          <div className={`p-3 rounded-lg text-xs font-bold tracking-wide uppercase text-center ${
            statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#666] text-xs font-bold uppercase tracking-wider">
            Ładowanie odizolowanej bazy plikowej demo...
          </div>
        ) : (
          <>
            {/* ZAKŁADKA 1: PRZEGLĄD I GRAFIK */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-brand-gold" />
                    <span>Dzisiejsza Obsada Zmiany (Demo)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">Osoba Prowadząca (Lead)</p>
                      <p className="text-sm font-extrabold text-white mt-1">Jan Kowalski (Manager Demo)</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">Osoba Wspomagająca (Support)</p>
                      <p className="text-sm font-extrabold text-white mt-1">Michał Nowak (Pracownik Demo)</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Użytkownicy w Bazie Demo</h3>
                  <div className="divide-y divide-white/5 text-xs">
                    {demoData?.users.map(u => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white">{u.displayName}</span>
                          <span className="text-[10px] text-[#666] ml-2 font-mono">({u.email})</span>
                        </div>
                        <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold font-bold uppercase rounded text-[10px]">
                          {u.position}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ZAKŁADKA 2: CHECKLISTY */}
            {activeTab === 'checklists' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Checklista Dnia (Kliknij, aby odznaczyć/zaznaczyć)</h3>
                <div className="space-y-2">
                  {demoData?.checklists.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleToggleChecklist(c.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        c.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {c.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#555] shrink-0" />
                        )}
                        <div>
                          <p className={`text-xs font-bold ${c.status === 'completed' ? 'line-through opacity-80' : ''}`}>{c.title}</p>
                          <p className="text-[9px] text-[#888] uppercase tracking-wider">{c.section} • {c.type === 'opening' ? 'Otwarcie' : 'Zamknięcie'}</p>
                        </div>
                      </div>
                      {c.completedByName && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ {c.completedByName}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ZAKŁADKA 3: ZADANIA */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Wpisz nowe zadanie demo..."
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-brand-gold"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-gold text-brand-dark font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Dodaj</span>
                  </button>
                </form>

                <div className="space-y-2">
                  {demoData?.tasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleToggleTask(t.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        t.completed ? 'bg-white/2 border-white/5 text-[#666]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {t.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-brand-gold shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#555] shrink-0" />
                        )}
                        <div>
                          <p className={`text-xs font-bold ${t.completed ? 'line-through' : ''}`}>{t.title}</p>
                          {t.description && <p className="text-[10px] text-[#666]">{t.description}</p>}
                        </div>
                      </div>
                      <span className="text-[10px] text-[#666] font-mono">{t.assignedToName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ZAKŁADKA 4: MAGAZYN */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Produkty Magazynowe Demo (Testuj dodawanie/odejmowanie)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {demoData?.inventory.map(p => (
                    <div key={p.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                      <div>
                        <p className="text-xs font-extrabold text-white">{p.name}</p>
                        <p className="text-[10px] text-[#666] font-mono">SKU: {p.sku} • Kat: {p.category}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs font-bold text-brand-gold font-mono">
                          Stan: {p.currentStock} {p.unit}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStockChange(p.id, -1)}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded cursor-pointer"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleStockChange(p.id, 1)}
                            className="px-2.5 py-1 bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold font-bold text-xs rounded cursor-pointer"
                          >
                            +1
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* DOLNY PASEK NAWIGACJI */}
      <footer className="bg-[#1f1f1f] border-t border-white/10 text-white px-4 md:px-8 py-3 flex items-center justify-between shadow-md text-xs font-bold uppercase tracking-wider">
        <Link href="/dashboard" className="text-[#a0a0a0] hover:text-brand-gold flex items-center gap-1.5">
          <Home className="w-4 h-4" />
          <span>Powrót do Głównego Portalu</span>
        </Link>
        <span className="text-[10px] text-[#666] font-mono normal-case">Ostatnia aktualizacja bazy plikowej: {demoData?.lastUpdated ? new Date(demoData.lastUpdated).toLocaleTimeString('pl-PL') : '-'}</span>
      </footer>
    </div>
  );
}
