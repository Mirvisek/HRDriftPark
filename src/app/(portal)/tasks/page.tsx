'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  getTasksForDateAction,
  addAdditionalTaskAction,
  toggleTaskStatusAction,
  deleteAdditionalTaskAction
} from '@/app/actions/taskActions';
import { 
  ClipboardList, 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  Clock, 
  User, 
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formularz nowego zadania
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = session?.user ? {
    id: Number((session.user as any).id),
    role: (session.user as any).role || 'employee',
  } : null;

  const isManagerOrOwner = currentUser && (
    currentUser.role === 'owner' || 
    currentUser.role === 'manager' || 
    currentUser.role === 'technik'
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTasksForDateAction(selectedDate);
      if (res.success) {
        setTasks(res.data || []);
      } else {
        setError(res.error || 'Błąd ładowania listy zadań.');
      }
    } catch (e) {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadTasks();
    }
  }, [selectedDate, status]);

  const handleToggleTask = async (taskId: number, currentCompleted: boolean) => {
    // Aktualizacja optymistyczna w UI
    const targetState = !currentCompleted;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isCompleted: targetState,
          completedByName: targetState ? (session?.user?.name || 'Pracownik') : null,
          completedAt: targetState ? new Date().toISOString() : null
        };
      }
      return t;
    }));

    try {
      const res = await toggleTaskStatusAction(taskId, targetState);
      if (!res.success) {
        // Przywróć poprzedni stan w razie błędu
        loadTasks();
      }
    } catch (e) {
      loadTasks();
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setActionLoading(true);

    try {
      const res = await addAdditionalTaskAction(selectedDate, newTitle, newPriority);
      if (res.success) {
        setNewTitle('');
        setNewPriority('medium');
        loadTasks();
      } else {
        setError(res.error || 'Błąd zapisu zadania.');
      }
    } catch (err) {
      setError('Błąd serwera.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć to zadanie dodatkowe?')) return;
    try {
      const res = await deleteAdditionalTaskAction(taskId);
      if (res.success) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      } else {
        alert(res.error || 'Błąd usuwania zadania.');
      }
    } catch (e) {
      alert('Błąd serwera przy usuwaniu.');
    }
  };

  const recurringTasks = tasks.filter(t => t.type === 'recurring');
  const additionalTasks = tasks.filter(t => t.type === 'additional');

  const priorityLabels = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki'
  };

  const priorityStyles = {
    low: 'bg-[#222] text-[#888] border border-white/5',
    medium: 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20',
    high: 'bg-brand-red/10 text-brand-red border border-brand-red/20'
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
            LISTA <span className="text-brand-gold">ZADAŃ NA ZMIANĘ</span>
          </h2>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Zaznaczaj wykonane czynności i dodawaj pilne zadania dla zespołu.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#888] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand-gold" /> Data dyżuru:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-xs text-white font-bold tracking-wider focus:outline-none focus:border-brand-gold"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main checklist split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* recurring tasks */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-gold" />
              <span>1. Zadania poza ruchem (Stałe)</span>
            </h3>
            <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded font-extrabold">
              {recurringTasks.filter(t => t.isCompleted).length} / {recurringTasks.length}
            </span>
          </div>

          <div className="space-y-3">
            {recurringTasks.length === 0 ? (
              <div className="glass-card p-6 text-center text-xs text-[#555] italic rounded-2xl border border-white/5">
                Brak stałych zadań w tym dniu tygodnia.
              </div>
            ) : (
              recurringTasks.map(t => (
                <div
                  key={t.id}
                  onClick={() => handleToggleTask(t.id, t.isCompleted)}
                  className={`glass-card p-4 rounded-xl border transition cursor-pointer select-none flex items-start gap-3.5 ${
                    t.isCompleted 
                      ? 'bg-green-500/[0.01] border-green-500/20 text-[#666]' 
                      : 'border-white/5 hover:border-brand-gold/30 text-white'
                  }`}
                >
                  <button className="shrink-0 mt-0.5 text-brand-gold">
                    {t.isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-green-500" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 space-y-1.5">
                    <span className={`text-xs font-bold leading-relaxed block ${t.isCompleted ? 'line-through' : ''}`}>
                      {t.title}
                    </span>
                    {t.isCompleted && t.completedByName && (
                      <div className="flex items-center gap-3 text-[10px] text-green-500/60 font-semibold">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.completedByName}</span>
                        {t.completedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 
                            {new Date(t.completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* additional tasks */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-red" />
              <span>2. Dodatkowe zadania (Bieżące)</span>
            </h3>
            <span className="text-[10px] bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded font-extrabold">
              {additionalTasks.filter(t => t.isCompleted).length} / {additionalTasks.length}
            </span>
          </div>

          {/* Formularz dodawania zadań (Tylko dla menedżerów) */}
          {isManagerOrOwner && (
            <form onSubmit={handleAddTask} className="glass-card p-4 rounded-2xl border border-white/10 space-y-3.5 bg-white/[0.01]">
              <div className="text-[10px] font-bold text-brand-gold uppercase tracking-wider">Dodaj pilne zadanie dla zespołu:</div>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Treść zadania (np. Uzupełnić opony w gokarcie nr 4)"
                  className="flex-1 px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder-white/20 focus:outline-none focus:border-brand-gold transition"
                />
                <div className="flex gap-2">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="low">Priorytet: Niski</option>
                    <option value="medium">Priorytet: Średni</option>
                    <option value="high">Priorytet: Wysoki</option>
                  </select>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-xs rounded-lg shadow transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Dodaj</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {additionalTasks.length === 0 ? (
              <div className="glass-card p-6 text-center text-xs text-[#555] italic rounded-2xl border border-white/5">
                Brak zadań dodatkowych zaplanowanych na dzisiaj.
              </div>
            ) : (
              additionalTasks.map(t => (
                <div
                  key={t.id}
                  className={`glass-card p-4 rounded-xl border transition flex items-start gap-3.5 relative group ${
                    t.isCompleted 
                      ? 'bg-green-500/[0.01] border-green-500/20 text-[#666]' 
                      : 'border-white/5 hover:border-brand-gold/30 text-white'
                  }`}
                >
                  <button 
                    onClick={() => handleToggleTask(t.id, t.isCompleted)}
                    className="shrink-0 mt-0.5 text-brand-gold cursor-pointer"
                  >
                    {t.isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-green-500" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-xs font-bold leading-relaxed ${t.isCompleted ? 'line-through' : ''}`}>
                        {t.title}
                      </span>
                      {!t.isCompleted && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${priorityStyles[t.priority as 'low' | 'medium' | 'high']}`}>
                          {priorityLabels[t.priority as 'low' | 'medium' | 'high']}
                        </span>
                      )}
                    </div>
                    {t.isCompleted && t.completedByName && (
                      <div className="flex items-center gap-3 text-[10px] text-green-500/60 font-semibold">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.completedByName}</span>
                        {t.completedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 
                            {new Date(t.completedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Usuwanie zadania (tylko dla menedżerów) */}
                  {isManagerOrOwner && (
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1 hover:bg-brand-red/10 text-[#555] hover:text-brand-red rounded transition cursor-pointer md:opacity-0 md:group-hover:opacity-100 self-center"
                      title="Usuń zadanie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
