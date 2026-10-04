'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  UserPlus, 
  Trash2, 
  Calendar, 
  Check, 
  AlertCircle,
  Plus,
  X,
  Edit,
  KeyRound,
} from 'lucide-react';
import { 
  getUsersAction, 
  createUserAction, 
  deleteUserAction,
  updateUserRateAction,
  updateUserAction,
  resetUserPasswordAction,
  getVenuesAction,
} from '@/app/actions/settingsActions';
import { 
  getUserGroupsAction, 
} from '@/app/actions/groupActions';

const AVAILABLE_PERMISSIONS = [
  { key: 'schedule:view', label: 'Podgląd grafiku pracy' },
  { key: 'schedule:edit', label: 'Układanie i generowanie grafiku' },
  { key: 'timesheet:view_own', label: 'Ewidencja własnych godzin' },
  { key: 'timesheet:view_all', label: 'Podgląd kart godzin wszystkich' },
  { key: 'timesheet:edit_all', label: 'Edycja kart godzin wszystkich' },
  { key: 'tasks:view', label: 'Podgląd zadań na zmianie' },
  { key: 'tasks:edit', label: 'Zarządzanie zadaniami i szablonami' },
  { key: 'payroll:view', label: 'Podgląd rozliczeń płacowych' },
  { key: 'settings:edit', label: 'Dostęp do ustawień i SMTP' },
  { key: 'users:manage', label: 'Zarządzanie pracownikami i reset haseł' },
  { key: 'push:send', label: 'Wysyłanie ręcznych powiadomień push' },
  { key: 'inventory:view', label: 'Magazyn: Podgląd stanu i historii' },
  { key: 'inventory:deliver', label: 'Magazyn: Przyjmowanie dostaw' },
  { key: 'inventory:issue', label: 'Magazyn: Wydawanie na lokale' },
  { key: 'inventory:inventory', label: 'Magazyn: Przeprowadzanie inwentaryzacji' },
  { key: 'inventory:manage', label: 'Magazyn: Zarządzanie produktami/kategoriami' },
];

const getDefaultPermissionsForRole = (role: string): string => {
  if (role === 'owner') {
    return "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
  }
  if (role === 'manager') {
    return "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory";
  }
  if (role === 'technik') {
    return "schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
  }
  return "schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory";
};

export default function UsersTab() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [userGroupsList, setUserGroupsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [venuesList, setVenuesList] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    role: 'employee' as 'owner' | 'manager' | 'employee' | 'technik',
    position: 'Pracownik toru',
    birthDate: '',
    hourlyRate: 0,
    permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory',
    groupId: undefined as number | undefined,
    venueId: 1,
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [usersRes, venuesRes, groupsRes] = await Promise.all([
          getUsersAction(),
          getVenuesAction(),
          getUserGroupsAction(),
        ]);
        if (usersRes && usersRes.success) setUsersList(usersRes.users || []);
        if (groupsRes && groupsRes.success) setUserGroupsList(groupsRes.data || []);
        if (venuesRes && venuesRes.success) setVenuesList(venuesRes.venues || []);
      } catch (err) {
        console.error("Błąd ładowania danych ustawień:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await createUserAction(newUser);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Konto dla ${newUser.displayName} zostało utworzone. Dane logowania zostały wysłane e-mailem.` });
        setShowAddForm(false);
        setNewUser({
          firstName: '',
          lastName: '',
          displayName: '',
          email: '',
          role: 'employee',
          position: 'Pracownik toru',
          birthDate: '',
          hourlyRate: 0,
          permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory',
          groupId: undefined,
          venueId: 1,
        });
        const usersRes = await getUsersAction();
        if (usersRes.success) setUsersList(usersRes.users || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd tworzenia użytkownika.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteUser = async (id: number, displayName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć użytkownika ${displayName}? Ta operacja jest nieodwracalna.`)) {
      return;
    }

    setStatusMsg(null);
    setActionLoading(true);
    try {
      const res = await deleteUserAction(id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Użytkownik ${displayName} został usunięty z systemu.` });
        const usersRes = await getUsersAction();
        if (usersRes.success) setUsersList(usersRes.users || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd podczas usuwania użytkownika.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResetPassword = async (id: number, displayName: string) => {
    if (!confirm(`Czy na pewno chcesz zresetować hasło dla użytkownika ${displayName}? System wygeneruje nowe hasło tymczasowe.`)) {
      return;
    }

    setStatusMsg(null);
    setActionLoading(true);
    try {
      const res = await resetUserPasswordAction(id);
      if (res.success) {
        setStatusMsg({ 
          type: 'success', 
          text: `Zresetowano hasło dla ${displayName}. Hasło tymczasowe zostało wysłane e-mailem (nie jest pokazywane w panelu ze względów bezpieczeństwa).` 
        });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd resetowania hasła.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartEdit = (user: any) => {
    setEditingUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      position: user.position,
      birthDate: user.birthDate,
      permissions: user.permissions || '',
      venueId: user.venueId
    });
    setShowAddForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await updateUserAction(editingUser.id, editingUser);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zaktualizowano dane użytkownika ${editingUser.displayName}.` });
        setEditingUser(null);
        const usersRes = await getUsersAction();
        if (usersRes.success) setUsersList(usersRes.users || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd aktualizacji użytkownika.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (newUser.firstName || newUser.lastName) {
      setNewUser(prev => ({
        ...prev,
        displayName: `${prev.firstName} ${prev.lastName}`.trim()
      }));
    }
  }, [newUser.firstName, newUser.lastName]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  const roleBadges: Record<string, string> = {
    owner: 'bg-brand-red/10 border border-brand-red/30 text-brand-red',
    manager: 'bg-blue-500/10 border border-blue-500/30 text-blue-400',
    employee: 'bg-green-500/10 border border-green-500/30 text-green-400',
    technik: 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold',
  };

  const roleNames: Record<string, string> = {
    owner: 'Właściciel',
    manager: 'Menedżer',
    employee: 'Pracownik',
    technik: 'Technik',
  };

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

          {/* Przycisk dodawania i panel */}
          <div className="flex justify-between items-center">
            <h3 className="text-md font-bold text-white uppercase tracking-wider">
              Lista Użytkowników ({usersList.length})
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-90 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? 'Anuluj' : 'Dodaj pracownika'}</span>
            </button>
          </div>

          {/* Formularz edycji użytkownika */}
          {editingUser && (
            <div className="glass-card p-6 rounded-2xl border border-brand-gold/30 relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold via-yellow-500 to-brand-gold" />
              
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-4 h-4 text-brand-gold" />
                <span>Edycja Profilu Pracownika: {editingUser.displayName}</span>
              </h4>

              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Imię</label>
                  <input
                    type="text"
                    required
                    value={editingUser.firstName}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwisko</label>
                  <input
                    type="text"
                    required
                    value={editingUser.lastName}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwa Wyświetlana</label>
                  <input
                    type="text"
                    required
                    value={editingUser.displayName}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Adres E-mail</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Rola w systemie</label>
                  <select
                    value={editingUser.role}
                    onChange={e => {
                      const newRole = e.target.value as any;
                      setEditingUser((prev: any) => ({
                        ...prev,
                        role: newRole,
                        permissions: getDefaultPermissionsForRole(newRole)
                      }));
                    }}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="employee">Pracownik (Ewidencja, Grafik, Dyspozycja)</option>
                    <option value="manager">Menedżer (Panel Menedżera, Akceptacje)</option>
                    <option value="technik">Technik (Pełen dostęp + Ustawienia)</option>
                    <option value="owner">Właściciel (Pełen dostęp + Ustawienia)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Stanowisko (Wyświetlane)</label>
                  <input
                    type="text"
                    required
                    value={editingUser.position}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Data urodzenia (Weryfikacja)</label>
                  <input
                    type="date"
                    required
                    value={editingUser.birthDate}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypisany Lokal</label>
                  <select
                    value={editingUser.venueId || ''}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, venueId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="">-- Brak / Centrala --</option>
                    {venuesList.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Grupa Uprawnień (Szablon)</label>
                  <select
                    value={editingUser.groupId || ''}
                    onChange={e => {
                      const gId = e.target.value ? Number(e.target.value) : undefined;
                      const selectedGroup = userGroupsList.find(g => g.id === gId);
                      setEditingUser((prev: any) => ({
                        ...prev,
                        groupId: gId,
                        permissions: selectedGroup ? selectedGroup.permissions : prev.permissions
                      }));
                    }}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="">-- Domyślna dla roli --</option>
                    {userGroupsList.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.permissions.split(',').filter(Boolean).length} uprawnień)</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
                  <label className="block text-[11px] font-extrabold text-[#ffd700] uppercase tracking-wider mb-3">
                    Indywidualne Uprawnienia Dostępowe:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {AVAILABLE_PERMISSIONS.map(p => {
                      const permissionsArray = editingUser.permissions ? editingUser.permissions.split(',') : [];
                      const isChecked = permissionsArray.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-start gap-2.5 p-2 bg-white/2 rounded-lg hover:bg-white/5 transition cursor-pointer select-none border border-white/5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newPerms: string[];
                              if (e.target.checked) {
                                newPerms = [...permissionsArray, p.key];
                              } else {
                                newPerms = permissionsArray.filter((k: string) => k !== p.key);
                              }
                              setEditingUser((prev: any) => ({ ...prev, permissions: newPerms.join(',') }));
                            }}
                            className="mt-0.5 rounded border-white/10 bg-[#141414] text-brand-gold focus:ring-brand-gold"
                          />
                          <div>
                            <span className="block text-xs font-semibold text-white">{p.label}</span>
                            <span className="block text-[10px] text-[#666] font-mono">{p.key}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2.5 bg-[#222] hover:bg-[#333] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-brand-gold to-yellow-500 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark"></div>
                    ) : (
                      'Zapisz zmiany'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Formularz dodawania użytkownika */}
          {showAddForm && (
            <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
              
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-gold" />
                <span>Nowy Profil Pracownika</span>
              </h4>

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Imię</label>
                  <input
                    type="text"
                    required
                    value={newUser.firstName}
                    onChange={e => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="np. Jan"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwisko</label>
                  <input
                    type="text"
                    required
                    value={newUser.lastName}
                    onChange={e => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="np. Kowalski"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwa Wyświetlana</label>
                  <input
                    type="text"
                    required
                    value={newUser.displayName}
                    onChange={e => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="np. Jan Kowalski"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Adres E-mail</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="np. jan.kowalski@driftpark.pl"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Rola w systemie</label>
                  <select
                    value={newUser.role}
                    onChange={e => {
                      const newRole = e.target.value as any;
                      setNewUser(prev => ({
                        ...prev,
                        role: newRole,
                        permissions: getDefaultPermissionsForRole(newRole)
                      }));
                    }}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="employee">Pracownik (Ewidencja, Grafik, Dyspozycja)</option>
                    <option value="manager">Menedżer (Panel Menedżera, Akceptacje)</option>
                    <option value="technik">Technik (Pełen dostęp + Ustawienia)</option>
                    <option value="owner">Właściciel (Pełen dostęp + Ustawienia)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Stanowisko (Wyświetlane)</label>
                  <input
                    type="text"
                    required
                    value={newUser.position}
                    onChange={e => setNewUser(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="np. Instruktor Driftu"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Data urodzenia (Weryfikacja)</label>
                  <input
                    type="date"
                    required
                    value={newUser.birthDate}
                    onChange={e => setNewUser(prev => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Stawka godzinowa (PLN/h)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newUser.hourlyRate}
                    onChange={e => setNewUser(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypisany Lokal</label>
                  <select
                    value={newUser.venueId || ''}
                    onChange={e => setNewUser(prev => ({ ...prev, venueId: e.target.value ? Number(e.target.value) : '' as any }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="">-- Brak / Centrala --</option>
                    {venuesList.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Grupa Uprawnień (Szablon)</label>
                  <select
                    value={newUser.groupId || ''}
                    onChange={e => {
                      const gId = e.target.value ? Number(e.target.value) : undefined;
                      const selectedGroup = userGroupsList.find(g => g.id === gId);
                      setNewUser(prev => ({
                        ...prev,
                        groupId: gId,
                        permissions: selectedGroup ? selectedGroup.permissions : prev.permissions
                      }));
                    }}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="">-- Domyślna dla roli --</option>
                    {userGroupsList.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.permissions.split(',').filter(Boolean).length} uprawnień)</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 border-t border-white/5 pt-4 mt-2">
                  <label className="block text-[11px] font-extrabold text-[#ffd700] uppercase tracking-wider mb-3">
                    Indywidualne Uprawnienia Dostępowe:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {AVAILABLE_PERMISSIONS.map(p => {
                      const permissionsArray = newUser.permissions ? newUser.permissions.split(',') : [];
                      const isChecked = permissionsArray.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-start gap-2.5 p-2 bg-white/2 rounded-lg hover:bg-white/5 transition cursor-pointer select-none border border-white/5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newPerms: string[];
                              if (e.target.checked) {
                                newPerms = [...permissionsArray, p.key];
                              } else {
                                newPerms = permissionsArray.filter((k: string) => k !== p.key);
                              }
                              setNewUser(prev => ({ ...prev, permissions: newPerms.join(',') }));
                            }}
                            className="mt-0.5 rounded border-white/10 bg-[#141414] text-brand-gold focus:ring-brand-gold"
                          />
                          <div>
                            <span className="block text-xs font-semibold text-white">{p.label}</span>
                            <span className="block text-[10px] text-[#666] font-mono">{p.key}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2.5 bg-[#222] hover:bg-[#333] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark"></div>
                    ) : (
                      'Zapisz i Wyślij dane'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela użytkowników */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2 text-[#a0a0a0] font-bold uppercase tracking-wider">
                    <th className="p-4">Nazwa wyświetlana</th>
                    <th className="p-4">E-mail</th>
                    <th className="p-4">Stanowisko</th>
                    <th className="p-4">Lokal</th>
                    <th className="p-4">Rola</th>
                    <th className="p-4">Stawka</th>
                    <th className="p-4">Data urodzenia</th>
                    <th className="p-4 text-center">Pierwsze logowanie</th>
                    <th className="p-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersList.map(u => {
                    const isSelf = Number(u.id) === Number((session?.user as any)?.id);
                    return (
                      <tr key={u.id} className="hover:bg-white/2 transition">
                        <td className="p-4 font-bold text-white">
                          <div>{u.displayName}</div>
                          <div className="text-[10px] text-[#666] font-normal font-mono">{u.firstName} {u.lastName}</div>
                        </td>
                        <td className="p-4 text-[#a0a0a0]">{u.email}</td>
                        <td className="p-4 text-[#e0e0e0]">{u.position}</td>
                        <td className="p-4 text-[#e0e0e0]">
                          {venuesList.find(v => v.id === u.venueId)?.name || <span className="text-white/30 italic">Centrala</span>}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${roleBadges[u.role] || ''}`}>
                            {roleNames[u.role] || u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={u.hourlyRate || 0}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== u.hourlyRate) {
                                  const res = await updateUserRateAction(u.id, val);
                                  if (res.success) {
                                    setStatusMsg({ type: 'success', text: `Zaktualizowano stawkę dla ${u.displayName} na ${val} PLN/h.` });
                                    setUsersList(prev => prev.map(item => item.id === u.id ? { ...item, hourlyRate: val } : item));
                                  } else {
                                    setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu stawki.' });
                                    e.target.value = String(u.hourlyRate || 0);
                                  }
                                }
                              }}
                              className="w-14 px-1.5 py-1 bg-[#141414] border border-white/10 rounded text-center text-xs text-white focus:outline-none focus:border-brand-gold transition font-semibold"
                            />
                            <span className="text-[#555] text-[10px]">PLN/h</span>
                          </div>
                        </td>
                        <td className="p-4 text-[#a0a0a0] font-mono">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#555]" />
                            <span>{u.birthDate}</span>
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {u.mustChangePassword ? (
                            <span className="px-2 py-0.5 rounded bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[9px] font-bold uppercase">
                              Wymagane
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-bold uppercase">
                              Zmienione
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStartEdit(u)}
                            disabled={actionLoading}
                            className="p-1.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                            title="Edytuj dane profilu"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(u.id, u.displayName)}
                            disabled={actionLoading}
                            className="p-1.5 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold hover:bg-brand-gold/20 hover:border-brand-gold/30 rounded-lg transition cursor-pointer"
                            title="Resetuj hasło"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.displayName)}
                              disabled={actionLoading}
                              className="p-1.5 bg-brand-red/10 border border-brand-red/20 text-brand-red hover:bg-brand-red/20 hover:border-brand-red/30 rounded-lg transition cursor-pointer"
                              title="Usuń użytkownika"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {isSelf && (
                            <span className="text-[9px] text-[#555] italic uppercase tracking-wider font-bold">Ty</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
  );
}
