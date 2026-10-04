'use client';

import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Check, 
  AlertCircle,
  Plus,
  X,
  Edit,
  Shield,
} from 'lucide-react';
import { 
  getUserGroupsAction, 
  saveUserGroupAction, 
  deleteUserGroupAction 
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

export default function GroupsTab() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [userGroupsList, setUserGroupsList] = useState<any[]>([]);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    roleKey: '',
    permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory'
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const groupsRes = await getUserGroupsAction();
        if (groupsRes && groupsRes.success) setUserGroupsList(groupsRes.data || []);
      } catch (err) {
        console.error("Błąd ładowania grup:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await saveUserGroupAction(newGroup);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Utworzono nową grupę uprawnień: ${newGroup.name}.` });
        setShowAddGroupForm(false);
        setNewGroup({
          name: '',
          roleKey: '',
          permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory'
        });
        const groupsRes = await getUserGroupsAction();
        if (groupsRes.success) setUserGroupsList(groupsRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd tworzenia grupy.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await saveUserGroupAction({
        id: editingGroup.id,
        name: editingGroup.name,
        roleKey: editingGroup.roleKey,
        permissions: editingGroup.permissions
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zaktualizowano uprawnienia dla grupy ${editingGroup.name}.` });
        setEditingGroup(null);
        const groupsRes = await getUserGroupsAction();
        if (groupsRes.success) setUserGroupsList(groupsRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd aktualizacji grupy.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć grupę ${groupName}? Wszystkie konta pracowników zachowają swoje dotychczasowe indywidualne uprawnienia.`)) {
      return;
    }

    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await deleteUserGroupAction(groupId);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Grupa ${groupName} została usunięta.` });
        const groupsRes = await getUserGroupsAction();
        if (groupsRes.success) setUserGroupsList(groupsRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd podczas usuwania grupy.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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

          {/* Nagłówek i przycisk Dodaj Grupę */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-md font-bold text-white uppercase tracking-wider">
                Zarządzanie Grupami & Rolami ({userGroupsList.length})
              </h3>
              <p className="text-xs text-[#a0a0a0]">
                Definiuj szablony uprawnień dla poszczególnych stanowisk i grup pracowniczych.
              </p>
            </div>
            <button
              onClick={() => { setShowAddGroupForm(!showAddGroupForm); setEditingGroup(null); }}
              className="px-4 py-2 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-90 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              {showAddGroupForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddGroupForm ? 'Anuluj' : 'Dodaj grupę'}</span>
            </button>
          </div>

          {/* Formularz Edycji Grupy */}
          {editingGroup && (
            <div className="glass-card p-6 rounded-2xl border border-brand-gold/30 relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold via-yellow-500 to-brand-gold" />
              
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-4 h-4 text-brand-gold" />
                <span>Edycja Uprawnień Grupy: {editingGroup.name}</span>
              </h4>

              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwa Grupy</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.name}
                      onChange={e => setEditingGroup((prev: any) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Klucz Roli (Systemowy)</label>
                    <input
                      type="text"
                      disabled
                      value={editingGroup.roleKey}
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-[#777] text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <label className="block text-[11px] font-extrabold text-[#ffd700] uppercase tracking-wider mb-3">
                    Matryca Uprawnień Grupy:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {AVAILABLE_PERMISSIONS.map(p => {
                      const permsArr = editingGroup.permissions ? editingGroup.permissions.split(',').map((s: string) => s.trim()) : [];
                      const isChecked = permsArr.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-start gap-2.5 p-2 bg-white/2 rounded-lg hover:bg-white/5 transition cursor-pointer select-none border border-white/5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newPerms: string[];
                              if (e.target.checked) {
                                newPerms = [...permsArr, p.key];
                              } else {
                                newPerms = permsArr.filter((k: string) => k !== p.key);
                              }
                              setEditingGroup((prev: any) => ({ ...prev, permissions: newPerms.join(',') }));
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

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
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
                      'Zapisz uprawnienia grupy'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Formularz Dodawania Nowej Grupy */}
          {showAddGroupForm && (
            <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden animate-fadeIn">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
              
              <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-gold" />
                <span>Tworzenie Nowej Grupy Uprawnień</span>
              </h4>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwa Grupy (np. Pracownik Toru / Kierownik Magazynu)</label>
                    <input
                      type="text"
                      required
                      value={newGroup.name}
                      onChange={e => setNewGroup(prev => ({ ...prev, name: e.target.value, roleKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                      placeholder="np. Pracownik Toru"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Klucz Identyfikacyjny Roli</label>
                    <input
                      type="text"
                      required
                      value={newGroup.roleKey}
                      onChange={e => setNewGroup(prev => ({ ...prev, roleKey: e.target.value }))}
                      placeholder="np. track_employee"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <label className="block text-[11px] font-extrabold text-[#ffd700] uppercase tracking-wider mb-3">
                    Matryca Uprawnień Grupy:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {AVAILABLE_PERMISSIONS.map(p => {
                      const permsArr = newGroup.permissions ? newGroup.permissions.split(',').map((s: string) => s.trim()) : [];
                      const isChecked = permsArr.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-start gap-2.5 p-2 bg-white/2 rounded-lg hover:bg-white/5 transition cursor-pointer select-none border border-white/5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newPerms: string[];
                              if (e.target.checked) {
                                newPerms = [...permsArr, p.key];
                              } else {
                                newPerms = permsArr.filter((k: string) => k !== p.key);
                              }
                              setNewGroup(prev => ({ ...prev, permissions: newPerms.join(',') }));
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

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddGroupForm(false)}
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
                      'Utwórz grupę'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela Grup */}
          <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#0a0a0a] border-b border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-[#a0a0a0]">
                  <tr>
                    <th className="p-4">Nazwa Grupy / Rola</th>
                    <th className="p-4">Klucz Roli</th>
                    <th className="p-4 text-center">Liczba Uprawnień</th>
                    <th className="p-4 text-center">Typ</th>
                    <th className="p-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#121212]">
                  {userGroupsList.map(group => {
                    const permCount = group.permissions ? group.permissions.split(',').filter(Boolean).length : 0;
                    return (
                      <tr key={group.id} className="hover:bg-white/2 transition">
                        <td className="p-4 font-bold text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-white font-bold">{group.name}</div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[#888]">
                          {group.roleKey}
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-brand-gold font-bold font-mono">
                            {permCount} / {AVAILABLE_PERMISSIONS.length}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {group.isSystem ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Systemowa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              Niestandardowa
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => { setEditingGroup(group); setShowAddGroupForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="p-2 text-brand-gold hover:bg-brand-gold/10 rounded-lg transition cursor-pointer"
                            title="Edytuj uprawnienia grupy"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!group.isSystem && (
                            <button
                              onClick={() => handleDeleteGroup(group.id, group.name)}
                              className="p-2 text-brand-red hover:bg-brand-red/10 rounded-lg transition cursor-pointer"
                              title="Usuń grupę"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
