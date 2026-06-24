'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Settings as SettingsIcon, 
  UserPlus, 
  Trash2, 
  Mail, 
  Lock, 
  Shield, 
  Calendar, 
  Info, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  X
} from 'lucide-react';
import { 
  getSettingsAction, 
  saveSettingsAction, 
  getUsersAction, 
  createUserAction, 
  deleteUserAction,
  testSmtpConnectionAction
} from '@/app/actions/settingsActions';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'smtp'>('users');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dane użytkowników
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    role: 'employee' as 'owner' | 'manager' | 'employee' | 'technik',
    position: 'Pracownik toru',
    birthDate: '',
  });

  // Dane SMTP
  const [smtpSettings, setSmtpSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_password: '',
    smtp_from: 'Drift Park Extreme <no-reply@driftparkextreme.pl>'
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Ochrona trasy (tylko owner i technik mają dostęp)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const role = (session?.user as any)?.role;
      if (role !== 'owner' && role !== 'technik') {
        router.push('/availability'); // Zwykły pracownik lub menedżer nie mają tu dostępu
      } else {
        loadData();
      }
    }
  }, [status, session, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, settingsRes] = await Promise.all([
        getUsersAction(),
        getSettingsAction()
      ]);

      if (usersRes.success) {
        setUsersList(usersRes.users || []);
      }
      if (settingsRes.success && settingsRes.settings) {
        setSmtpSettings(prev => ({
          ...prev,
          ...settingsRes.settings
        }));
      }
    } catch (err) {
      console.error("Błąd ładowania ustawień:", err);
    } finally {
      setLoading(false);
    }
  };

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
        });
        // Ponowne załadowanie listy
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
        // Ponowne załadowanie listy
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

  const handleTestSmtpConnection = async () => {
    setStatusMsg(null);
    setTestLoading(true);

    try {
      const res = await testSmtpConnectionAction(smtpSettings);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Połączenie z serwerem SMTP zostało nawiązane pomyślnie. Konfiguracja jest prawidłowa.' });
      } else {
        setStatusMsg({ type: 'error', text: `Błąd połączenia z serwerem SMTP: ${res.error}` });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem testowym.' });
    } finally {
      setTestLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setActionLoading(true);

    try {
      const res = await saveSettingsAction(smtpSettings);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Ustawienia SMTP zostały pomyślnie zaktualizowane.' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd podczas zapisywania ustawień.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setActionLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Automatyczne generowanie display name przy zmianie imienia i nazwiska
  useEffect(() => {
    if (newUser.firstName || newUser.lastName) {
      setNewUser(prev => ({
        ...prev,
        displayName: `${prev.firstName} ${prev.lastName}`.trim()
      }));
    }
  }, [newUser.firstName, newUser.lastName]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
          USTAWIENIA <span className="text-brand-gold">SYSTEMOWE</span>
        </h2>
        <p className="text-xs text-[#a0a0a0] mt-1">
          Zarządzaj kontami pracowników toru oraz konfiguracją powiadomień e-mail.
        </p>
      </div>

      {/* Komunikat o statusie */}
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

      {/* Zakładki */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => { setActiveTab('users'); setStatusMsg(null); }}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Użytkownicy</span>
        </button>
        <button
          onClick={() => { setActiveTab('smtp'); setStatusMsg(null); }}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'smtp'
              ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
              : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>SMTP & E-mail</span>
        </button>
      </div>

      {/* Zawartość Zakładki: UŻYTKOWNICY */}
      {activeTab === 'users' && (
        <div className="space-y-6">
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
                    onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
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
                    <th className="p-4">Rola</th>
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
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${roleBadges[u.role] || ''}`}>
                            {roleNames[u.role] || u.role}
                          </span>
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
                        <td className="p-4 text-right">
                          {isSelf ? (
                            <span className="text-[10px] text-[#555] italic">Twoje konto</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.displayName)}
                              disabled={actionLoading}
                              className="p-1.5 bg-brand-red/10 border border-brand-red/20 text-brand-red hover:bg-brand-red/20 hover:border-brand-red/30 rounded-lg transition cursor-pointer"
                              title="Usuń użytkownika"
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
      )}

      {/* Zawartość Zakładki: SMTP & EMAIL */}
      {activeTab === 'smtp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informacja boczna */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 h-fit lg:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-[#ffaa00]/10 flex items-center justify-center text-[#ffaa00]">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Konfiguracja SMTP</h3>
            <p className="text-xs text-[#a0a0a0] leading-relaxed">
              System wykorzystuje pocztę e-mail do wysyłania:
            </p>
            <ul className="text-xs text-[#a0a0a0] list-disc list-inside space-y-1">
              <li>Haseł tymczasowych do nowo utworzonych profili pracowników.</li>
              <li>Linków do odzyskiwania zapomnianych haseł.</li>
            </ul>
            
            <div className="p-3.5 bg-brand-gold/10 border border-brand-gold/20 text-[#ffd700] rounded-xl text-xs space-y-2 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>Środowisko Testowe</span>
              </p>
              <p>
                W przypadku braku wpisanych danych SMTP (np. w środowisku deweloperskim), aplikacja automatycznie przechwyci wszystkie generowane e-maile i zapisze je do pliku tekstowego na serwerze:
              </p>
              <p className="font-mono bg-black/40 p-1.5 rounded text-[10px] break-all">
                scratch/sent_emails.log
              </p>
              <p>
                Pozwala to na weryfikację linków i haseł bez potrzeby posiadania działającego serwera pocztowego.
              </p>
            </div>
          </div>

          {/* Formularz SMTP */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-gold" />
              <span>Parametry Serwera Poczty Wychodzącej</span>
            </h3>

            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Host SMTP</label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_host}
                    onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_host: e.target.value }))}
                    placeholder="np. smtp.gmail.com lub mail.twojadomena.pl"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Port SMTP</label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_port}
                    onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_port: e.target.value }))}
                    placeholder="np. 587, 465 lub 25"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Użytkownik SMTP (Login)</label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_user}
                    onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_user: e.target.value }))}
                    placeholder="np. twoj-mail@gmail.com"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Hasło SMTP</label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={smtpSettings.smtp_password}
                      onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_password: e.target.value }))}
                      placeholder="Wpisz hasło do konta pocztowego"
                      className="w-full pl-3 pr-10 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition cursor-pointer"
                    >
                      {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Adres nadawcy (From)</label>
                  <input
                    type="text"
                    value={smtpSettings.smtp_from}
                    onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_from: e.target.value }))}
                    placeholder="Drift Park Extreme &lt;no-reply@driftparkextreme.pl&gt;"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-[#a0a0a0] cursor-pointer hover:text-white transition pt-2 select-none">
                    <input
                      type="checkbox"
                      checked={smtpSettings.smtp_secure === 'true'}
                      onChange={e => setSmtpSettings(prev => ({ ...prev, smtp_secure: e.target.checked ? 'true' : 'false' }))}
                      className="rounded bg-[#1a1a1a] border-white/10 text-brand-gold focus:ring-0 cursor-pointer w-4 h-4"
                    />
                    <span>Szyfrowanie SSL/TLS (Secure)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleTestSmtpConnection}
                  disabled={actionLoading || testLoading}
                  className="px-5 py-2.5 bg-[#1f1f1f] border border-white/10 hover:bg-[#282828] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {testLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                  ) : (
                    'Testuj połączenie'
                  )}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || testLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark"></div>
                  ) : (
                    'Zapisz ustawienia SMTP'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
