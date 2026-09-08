'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Sun, 
  CalendarDays, 
  Calendar, 
  Clock, 
  ClipboardCheck, 
  ClipboardList, 
  Package, 
  DollarSign, 
  Settings, 
  ArrowLeft, 
  Home, 
  LogOut,
  RotateCcw,
  Plus,
  CheckCircle2,
  Circle,
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

function DemoDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') || 'manager';

  const [demoData, setDemoData] = useState<DemoDataSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'grid' | 'today' | 'schedule' | 'checklists' | 'tasks' | 'inventory' | 'payroll' | 'settings'>('grid');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userName = roleParam === 'manager' 
    ? 'Jan Kowalski (Manager Demo)' 
    : roleParam === 'technik' 
    ? 'Piotr Wiśniewski (Technik Demo)' 
    : 'Michał Nowak (Pracownik Demo)';

  const loadDemoData = async () => {
    setLoading(true);
    const res = await getDemoDataAction();
    if (res.success && res.data) {
      setDemoData(res.data);
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
      setStatusMsg({ type: 'success', text: 'Dodano zadanie do niezależnej bazy demo!' });
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
    if (confirm('Czy na pewno chcesz przywrócić fabryczne dane testowe w bazy plikowej demo?')) {
      const res = await resetDemoStoreAction();
      if (res.success && res.data) {
        setDemoData(res.data);
        setStatusMsg({ type: 'success', text: 'Przywrócono fabryczny stan bazy demo.' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    }
  };

  const tiles = [
    { id: 'today', title: 'DZISIAJ (PANEL ZMIANY)', icon: Sun },
    { id: 'schedule', title: 'GRAFIK PRACY DEMO', icon: CalendarDays },
    { id: 'checklists', title: 'CHECKLISTY DEMO', icon: ClipboardCheck },
    { id: 'tasks', title: 'ZADANIA NA ZMIANIE DEMO', icon: ClipboardList },
    { id: 'inventory', title: 'MAGAZYN DEMO', icon: Package },
    { id: 'payroll', title: 'WYPŁATY / PAYROLL DEMO', icon: DollarSign },
    { id: 'settings', title: 'USTAWIENIA DEMO', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#141414] text-[#e0e0e0] flex flex-col justify-between font-sans">
      {/* BANER DEMO */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-brand-dark px-4 py-1.5 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-md shrink-0">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>🎭 NIEZALEŻNY TRYB DEMO — Plikowa baza danych (data/demo-db.json) • Zero zmian w MariaDB</span>
      </div>

      {/* GÓRNY PASEK NAWIGACJI (HEADER BAR) */}
      <header className="bg-[#333333] border-b border-white/10 text-white px-4 md:px-8 py-3 flex items-center justify-between shadow-md shrink-0 sticky top-0 z-30">
        <button
          onClick={() => activeSection === 'grid' ? router.push('/demo') : setActiveSection('grid')}
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-white transition flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>

        <div className="text-xs md:text-sm font-extrabold tracking-wider text-[#ffd700] uppercase font-display text-center truncate px-2">
          {userName}
        </div>

        <Link
          href="/demo"
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-brand-red transition flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5"
        >
          <span>Wyjdź z Demo</span>
          <LogOut className="w-4 h-4" />
        </Link>
      </header>

      {/* GŁÓWNY OBSZAR TREŚCI */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 overflow-y-auto">
        {statusMsg && (
          <div className={`mb-6 p-3 rounded-lg text-xs font-bold tracking-wide uppercase text-center ${
            statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-brand-red/20 text-brand-red border border-brand-red/30'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* 1. WIDOK KAFELKOWY (GRID) */}
        {activeSection === 'grid' && (
          <div className="py-4 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg md:text-xl font-extrabold text-white uppercase tracking-wider font-display">
                Pulpit Demonstracyjny
              </h2>
              <p className="text-xs text-[#a0a0a0]">
                Kliknij dowolny kafelek, aby przetestować niezależne moduły systemu
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {tiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    onClick={() => setActiveSection(tile.id as any)}
                    className="bg-[#186f75] hover:bg-[#1f878e] text-white font-extrabold p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col items-center justify-center text-center gap-3 h-32 md:h-40 active:scale-95 border border-white/10 group cursor-pointer"
                  >
                    <Icon className="w-8 h-8 text-white/90 group-hover:scale-110 transition-transform" />
                    <span className="text-xs md:text-sm tracking-wider uppercase">{tile.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. ZAKŁADKA DZISIAJ */}
        {activeSection === 'today' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Dzisiaj (Panel Zmiany Demo)</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <p className="text-xs text-[#a0a0a0]">Aktualna obsada dyżuru zapisanego w pliku demo:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">Prowadzący Zmianę</p>
                  <p className="text-sm font-extrabold text-white mt-1 font-display">Jan Kowalski (Manager Demo)</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">Obsługa Wspomagająca</p>
                  <p className="text-sm font-extrabold text-white mt-1 font-display">Michał Nowak (Pracownik Demo)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. ZAKŁADKA GRAFIK */}
        {activeSection === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Grafik Pracy Demo</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <p className="text-xs text-[#a0a0a0]">Harmonogram zasilony z lokalnej bazy plikowej:</p>
              <div className="divide-y divide-white/5 text-xs">
                {demoData?.schedule.map(s => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white font-mono">{s.date}</p>
                      <p className="text-[11px] text-[#888]">Lokal #1 (Tor Kartingowy Demo)</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-brand-gold font-bold">Obsada: Jan Kowalski & Michał Nowak</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. ZAKŁADKA CHECKLISTY */}
        {activeSection === 'checklists' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Checklisty Otwarcia i Zamknięcia</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
            <p className="text-xs text-[#a0a0a0]">Kliknij zadanie, aby je oznaczyć. Status zapisze się w bazie plikowej demo:</p>
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

        {/* 5. ZAKŁADKA ZADANIA */}
        {activeSection === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Zadania Zmiany Demo</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
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

        {/* 6. ZAKŁADKA MAGAZYN */}
        {activeSection === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Magazyn Demo (Testowanie Dostaw/Wydań)</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
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

        {/* 7. ZAKŁADKA WYPŁATY */}
        {activeSection === 'payroll' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Rozliczenia Płacowe Demo</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="divide-y divide-white/5 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-white">Jan Kowalski (Manager Demo)</p>
                    <p className="text-[10px] text-[#888]">Przepracowano: 160.00 h • Stawka: 35.00 zł/h</p>
                  </div>
                  <span className="text-sm font-extrabold text-brand-gold font-mono">5 600.00 PLN</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-white">Michał Nowak (Pracownik Demo)</p>
                    <p className="text-[10px] text-[#888]">Przepracowano: 140.00 h • Stawka: 28.50 zł/h</p>
                  </div>
                  <span className="text-sm font-extrabold text-brand-gold font-mono">3 990.00 PLN</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. ZAKŁADKA USTAWIENIA */}
        {activeSection === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-extrabold text-white uppercase tracking-wider">Ustawienia Środowiska Demo</h3>
              <button onClick={() => setActiveSection('grid')} className="text-xs text-brand-gold hover:underline">← Powrót do kafelków</button>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-brand-red/30 bg-brand-red/5 space-y-4">
              <h4 className="text-sm font-bold text-brand-red uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>Przywracanie Stanu Fabrycznego Demo</span>
              </h4>
              <p className="text-xs text-[#a0a0a0]">
                Kliknięcie przycisku zresetuje niezależny plik `data/demo-db.json` do wyjściowych danych startowych.
              </p>
              <button
                onClick={handleResetDemo}
                className="px-6 py-3 bg-brand-red text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Zresetuj Bazę Plikową Demo</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* DOLNY PASEK NAWIGACJI (FOOTER BAR) */}
      <footer className="bg-[#333333] border-t border-white/10 text-white px-4 md:px-8 py-3 flex items-center justify-between shadow-md shrink-0 sticky bottom-0 z-30">
        <button
          onClick={() => setActiveSection('grid')}
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-brand-gold transition flex items-center gap-1.5 py-1 px-3 rounded hover:bg-white/5"
        >
          <Home className="w-4 h-4" />
          <span>Główna Demo</span>
        </button>

        <button
          onClick={() => activeSection === 'grid' ? router.push('/demo') : setActiveSection('grid')}
          className="text-xs font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-white transition flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wstecz</span>
        </button>
      </footer>
    </div>
  );
}

export default function DemoDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center text-xs font-bold uppercase tracking-wider">
        Ładowanie Panelu Demo...
      </div>
    }>
      <DemoDashboardContent />
    </Suspense>
  );
}
