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
  X,
  ClipboardList,
  Edit,
  KeyRound,
  Building,
  Globe,
  Upload,
  ImageIcon,
  Bell,
  Clock,
  Palette,
  Layers
} from 'lucide-react';
import { 
  getSettingsAction, 
  saveSettingsAction, 
  getUsersAction, 
  createUserAction, 
  deleteUserAction,
  testSmtpConnectionAction,
  updateUserRateAction,
  updateUserAction,
  resetUserPasswordAction,
  getVenuesAction,
  saveVenueAction,
  deleteVenueAction,
  uploadLogoAction
} from '@/app/actions/settingsActions';
import { 
  getTaskTemplatesAction, 
  saveTaskTemplateAction, 
  deleteTaskTemplateAction 
} from '@/app/actions/taskActions';
import { hasPermission } from '@/lib/permissions';

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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'smtp' | 'tasks' | 'venues' | 'site'>('users');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dane użytkowników
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
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
    venueId: 1,
  });

  // Ustawienia strony
  const [siteSettings, setSiteSettings] = useState({
    site_name: 'Drift Park Extreme',
    site_address: '',
    site_nip: '',
    site_regon: '',
    site_phone: '',
    site_logo: '',
    site_timezone: 'Europe/Warsaw',
    site_currency: 'PLN',
    site_date_format: 'DD.MM.YYYY',
    alert_expiry_days: '30',
    alert_low_stock_global: 'true',
    security_session_hours: '24',
    security_force_password_days: '0',
    warehouse_suppliers: '',
    warehouse_locations: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Lokale
  const [venuesList, setVenuesList] = useState<any[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null);

  // Szablony zadań stałych
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateDay, setNewTemplateDay] = useState<number>(1); // Poniedziałek

  // Dane SMTP, Domena & Szablony Powiadomień
  const [smtpSettings, setSmtpSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_password: '',
    smtp_from: 'Drift Park Extreme <no-reply@driftparkextreme.pl>',
    site_url: '',
    template_shift_reminder_lead: 'Jutro masz zaplanowaną zmianę jako Osoba Prowadząca.',
    template_shift_reminder_support: 'Jutro masz zaplanowaną zmianę jako Osoba Wspomagająca.',
    template_shift_reminder_event: 'Jutro obsługujesz wydarzenie: {remarks}.',
    template_assignment_lead: 'Zostałeś przypisany jako Osoba Prowadząca w dniu {date}.',
    template_assignment_support: 'Zostałeś przypisany jako Osoba Wspomagająca w dniu {date}.',
    template_assignment_event: 'Obsługujesz wydarzenie: {remarks} w dniu {date}.',
    template_hours_change: 'Zmiana godzin pracy w dniu {date}: Lokal jest {status}.',
    template_schedule_published: 'Grafik Pracy na {month} został opublikowany! Wejdź w system i sprawdź go!'
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Ochrona trasy oparta na uprawnieniach
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const user = session?.user;
      if (hasPermission(user, 'users:manage')) {
        setActiveTab('users');
        loadData();
      } else if (hasPermission(user, 'settings:edit')) {
        setActiveTab('smtp');
        loadData();
      } else if (hasPermission(user, 'tasks:edit')) {
        setActiveTab('tasks');
        loadData();
      } else {
        router.push('/availability'); // Brak uprawnień do jakiejkolwiek sekcji ustawień
      }
    }
  }, [status, session, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = session?.user;
      
      const loadUsers = hasPermission(user, 'users:manage');
      const loadSettings = hasPermission(user, 'settings:edit');
      const loadTemplates = hasPermission(user, 'tasks:edit');

      const results = await Promise.all([
        loadUsers ? getUsersAction() : Promise.resolve(null),
        loadSettings ? getSettingsAction() : Promise.resolve(null),
        loadTemplates ? getTaskTemplatesAction() : Promise.resolve(null),
        getVenuesAction()
      ]);

      const [usersRes, settingsRes, templatesRes, venuesRes] = results;

      if (usersRes && usersRes.success) {
        setUsersList(usersRes.users || []);
      }
      
      if (settingsRes && settingsRes.success && settingsRes.settings) {
        setSmtpSettings(prev => ({
          ...prev,
          ...settingsRes.settings
        }));
        setSiteSettings(prev => ({
          ...prev,
          ...settingsRes.settings
        }));
        if (settingsRes.settings.site_logo) {
          setLogoPreview(settingsRes.settings.site_logo);
        }
      }

      if (templatesRes && templatesRes.success) {
        setTemplatesList(templatesRes.data || []);
      }

      if (venuesRes && venuesRes.success) {
        setVenuesList(venuesRes.venues || []);
      }
    } catch (err) {
      console.error("Błąd ładowania danych ustawień:", err);
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
          hourlyRate: 0,
          permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory',
          venueId: 1,
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
          text: `Zresetowano hasło dla ${displayName}. Nowe hasło tymczasowe to: ${res.tempPassword}. Przekaż je użytkownikowi lub poczekaj na wysyłkę e-mail.` 
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
    setShowAddForm(false); // Zamknij form dodawania, jeśli otwarty
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
        // Ponowne załadowanie listy
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
        {hasPermission(session?.user, 'users:manage') && (
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
        )}
        {hasPermission(session?.user, 'settings:edit') && (
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
        )}
        {hasPermission(session?.user, 'tasks:edit') && (
          <button
            onClick={() => { setActiveTab('tasks'); setStatusMsg(null); }}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
                : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Szablony zadań</span>
          </button>
        )}
        {hasPermission(session?.user, 'settings:edit') && (
          <button
            onClick={() => { setActiveTab('venues'); setStatusMsg(null); }}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'venues'
                ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
                : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Lokale</span>
          </button>
        )}
        {hasPermission(session?.user, 'settings:edit') && (
          <button
            onClick={() => { setActiveTab('site'); setStatusMsg(null); }}
            className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'site'
                ? 'border-brand-gold text-white bg-white/5 rounded-t-lg'
                : 'border-transparent text-[#a0a0a0] hover:text-white hover:bg-white/2'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Ustawienia Strony</span>
          </button>
        )}
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
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Adres URL strony (Własna domena)</label>
                  <input
                    type="url"
                    value={smtpSettings.site_url || ''}
                    onChange={e => setSmtpSettings(prev => ({ ...prev, site_url: e.target.value }))}
                    placeholder="np. https://hr.driftparkextreme.pl"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                  <p className="text-[9px] text-[#555] mt-1">
                    Adres URL wykorzystywany do generowania linków w wiadomościach e-mail (np. reset hasła, powitanie pracownika).
                  </p>
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

                {/* Sekcja szablonów powiadomień */}
                <div className="md:col-span-2 border-t border-white/5 pt-6 mt-6 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider text-brand-gold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    <span>Szablony Wiadomości (Powiadomienia Push & Systemowe)</span>
                  </h4>
                  <div className="text-[10px] text-[#888] leading-relaxed bg-[#181818] p-3 rounded-lg border border-white/5 space-y-1">
                    <p className="font-semibold text-white">Dynamiczne tagi do wykorzystania w szablonach:</p>
                    <p>• <strong className="text-brand-gold">{`{date}`}</strong> – data dyżuru (np. 2026-07-13)</p>
                    <p>• <strong className="text-brand-gold">{`{remarks}`}</strong> – opis wydarzenia w grafiku (np. Urodziny Piotra)</p>
                    <p>• <strong className="text-brand-gold">{`{status}`}</strong> – status/godziny pracy lokalu (np. otwarty w godzinach 15:00 - 20:00)</p>
                    <p>• <strong className="text-brand-gold">{`{month}`}</strong> – nazwa miesiąca i rok (np. Lipiec 2026)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypomnienie 24h: Prowadzący</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_shift_reminder_lead || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_shift_reminder_lead: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypomnienie 24h: Wspomagający</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_shift_reminder_support || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_shift_reminder_support: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypomnienie 24h: Wydarzenie</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_shift_reminder_event || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_shift_reminder_event: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypisanie na dyżur: Prowadzący</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_assignment_lead || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_assignment_lead: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypisanie na dyżur: Wspomagający</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_assignment_support || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_assignment_support: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Przypisanie na dyżur: Wydarzenie</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_assignment_event || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_assignment_event: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Zmiana godzin pracy toru</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_hours_change || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_hours_change: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Publikacja nowego grafiku</label>
                      <textarea
                        rows={2}
                        value={smtpSettings.template_schedule_published || ''}
                        onChange={e => setSmtpSettings(prev => ({ ...prev, template_schedule_published: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition resize-none"
                      />
                    </div>
                  </div>
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

      {activeTab === 'tasks' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden bg-white/[0.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-gold" />
              <span>Dodaj stałe zadanie do szablonu</span>
            </h4>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newTemplateTitle.trim()) return;
              setActionLoading(true);
              try {
                const res = await saveTaskTemplateAction(newTemplateTitle, newTemplateDay);
                if (res.success) {
                  setNewTemplateTitle('');
                  const templatesRes = await getTaskTemplatesAction();
                  if (templatesRes.success) setTemplatesList(templatesRes.data || []);
                  setStatusMsg({ type: 'success', text: 'Dodano szablon zadania pomyślnie.' });
                } else {
                  setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu szablonu.' });
                }
              } catch (err) {
                setStatusMsg({ type: 'error', text: 'Błąd połączenia z serwerem.' });
              } finally {
                setActionLoading(false);
              }
            }} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Treść zadania</label>
                <input
                  type="text"
                  required
                  value={newTemplateTitle}
                  onChange={e => setNewTemplateTitle(e.target.value)}
                  placeholder="np. Sprawdzić ciśnienie w oponach gokartów"
                  className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Dzień tygodnia</label>
                <select
                  value={newTemplateDay}
                  onChange={e => setNewTemplateDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                >
                  <option value={1}>Poniedziałek</option>
                  <option value={2}>Wtorek</option>
                  <option value={3}>Środa</option>
                  <option value={4}>Czwartek</option>
                  <option value={5}>Piątek</option>
                  <option value={6}>Sobota</option>
                  <option value={0}>Niedziela</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2 shrink-0 h-[38px] md:h-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Dodaj szablon</span>
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2 text-[#a0a0a0] font-bold uppercase tracking-wider">
                    <th className="p-4 w-[20%]">Dzień tygodnia</th>
                    <th className="p-4 w-[65%]">Zadanie stałe (poza ruchem)</th>
                    <th className="p-4 text-right w-[15%]">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#121212]">
                  {templatesList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-xs text-[#555] italic">
                        Brak zdefiniowanych szablonów zadań stałych. Dodaj pierwsze zadanie powyżej.
                      </td>
                    </tr>
                  ) : (
                    templatesList.map(t => {
                      const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
                      return (
                        <tr key={t.id} className="hover:bg-white/2 transition">
                          <td className="p-4 font-bold text-white font-mono">
                            {days[t.dayOfWeek]}
                          </td>
                          <td className="p-4 text-[#e0e0e0] font-semibold text-xs">
                            {t.title}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={async () => {
                                if (!confirm('Czy na pewno chcesz usunąć to zadanie z szablonu?')) return;
                                const res = await deleteTaskTemplateAction(t.id);
                                if (res.success) {
                                  setTemplatesList(prev => prev.filter(item => item.id !== t.id));
                                  setStatusMsg({ type: 'success', text: 'Usunięto szablon zadania.' });
                                } else {
                                  setStatusMsg({ type: 'error', text: res.error || 'Błąd usuwania szablonu.' });
                                }
                              }}
                              className="p-1.5 hover:bg-brand-red/10 text-[#555] hover:text-brand-red rounded-lg transition cursor-pointer"
                              title="Usuń szablon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Zawartość Zakładki: LOKALE */}
      {activeTab === 'venues' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formularz dodawania/edycji lokalu */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 h-fit relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-gold" />
                <span>{editingVenueId ? 'Edycja lokalu' : 'Dodaj nowy lokal'}</span>
              </h3>
              
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newVenueName.trim()) return;
                  setActionLoading(true);
                  try {
                    const res = await saveVenueAction(editingVenueId, newVenueName);
                    if (res.success) {
                      setStatusMsg({ type: 'success', text: editingVenueId ? 'Zmieniono nazwę lokalu.' : 'Dodano nowy lokal.' });
                      setNewVenueName('');
                      setEditingVenueId(null);
                      const vRes = await getVenuesAction();
                      if (vRes.success) setVenuesList(vRes.venues || []);
                    } else {
                      setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu lokalu.' });
                    }
                  } catch (err: any) {
                    setStatusMsg({ type: 'error', text: err.message });
                  } finally {
                    setActionLoading(false);
                    setTimeout(() => setStatusMsg(null), 4000);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Nazwa lokalu</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Tarnów, Warszawa"
                    value={newVenueName}
                    onChange={e => setNewVenueName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-brand-gold hover:opacity-95 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    {editingVenueId ? 'Zapisz' : 'Dodaj'}
                  </button>
                  {editingVenueId && (
                    <button
                      type="button"
                      onClick={() => { setEditingVenueId(null); setNewVenueName(''); }}
                      className="px-4 py-2 bg-[#222] text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Tabela lokali */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Lista Lokali</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                      <th className="pb-3 w-[10%]">ID</th>
                      <th className="pb-3 w-[45%]">Nazwa lokalu</th>
                      <th className="pb-3 w-[25%]">Utworzono</th>
                      <th className="pb-3 text-right w-[20%]">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                    {venuesList.map(v => (
                      <tr key={v.id} className="hover:bg-white/2 transition">
                        <td className="py-3 font-mono text-[#555]">{v.id}</td>
                        <td className="py-3 font-bold text-white">
                          {v.name} {v.id === 1 && <span className="text-[10px] text-brand-gold font-normal italic ml-1">(Domyślny)</span>}
                        </td>
                        <td className="py-3 text-[#666]">
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString('pl-PL') : '-'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingVenueId(v.id); setNewVenueName(v.name); }}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase rounded cursor-pointer transition border border-white/5"
                            >
                              Edytuj
                            </button>
                            {v.id !== 1 && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Czy na pewno chcesz usunąć lokal "${v.name}"?`)) return;
                                  setActionLoading(true);
                                  try {
                                    const res = await deleteVenueAction(v.id);
                                    if (res.success) {
                                      setStatusMsg({ type: 'success', text: 'Usunięto lokal.' });
                                      const vRes = await getVenuesAction();
                                      if (vRes.success) setVenuesList(vRes.venues || []);
                                    } else {
                                      setStatusMsg({ type: 'error', text: res.error || 'Błąd usuwania lokalu.' });
                                    }
                                  } catch (err: any) {
                                    setStatusMsg({ type: 'error', text: err.message });
                                  } finally {
                                    setActionLoading(false);
                                    setTimeout(() => setStatusMsg(null), 4000);
                                  }
                                }}
                                className="px-2 py-1 bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/20 text-brand-red text-[10px] font-bold uppercase rounded cursor-pointer transition"
                              >
                                Usuń
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* ZAKŁADKA: USTAWIENIA STRONY                                       */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'site' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setActionLoading(true);
              try {
                // Zapisz dane tekstowe
                const res = await saveSettingsAction(siteSettings);

                // Jeśli dodano nowe logo, uploaduj je oddzielnie
                if (logoFile) {
                  const fd = new FormData();
                  fd.append('file', logoFile);
                  const logoRes = await uploadLogoAction(fd);
                  if (logoRes.success && logoRes.logoUrl) {
                    setLogoPreview(logoRes.logoUrl);
                    setSiteSettings(prev => ({ ...prev, site_logo: logoRes.logoUrl! }));
                  } else {
                    setStatusMsg({ type: 'error', text: logoRes.error || 'Błąd uploadu logo.' });
                    return;
                  }
                }

                if (res.success) {
                  setStatusMsg({ type: 'success', text: 'Ustawienia strony zostały zapisane.' });
                  setLogoFile(null);
                } else {
                  setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu ustawień.' });
                }
              } catch (err: any) {
                setStatusMsg({ type: 'error', text: err.message });
              } finally {
                setActionLoading(false);
                setTimeout(() => setStatusMsg(null), 5000);
              }
            }}
            className="space-y-6"
          >
            {/* ---- Logo + Nazwa firmy ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand-gold" />
                <span>Identyfikacja Firmy</span>
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Logo */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">Logo Firmy</label>
                  <div className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all ${logoFile || logoPreview ? 'border-brand-gold/40 bg-brand-gold/5' : 'border-white/10 bg-white/2 hover:border-white/20'}`}>
                    {(logoPreview || logoFile) ? (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : logoPreview}
                        alt="Logo podgląd"
                        className="max-h-20 max-w-full object-contain rounded"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#555]">
                        <Upload className="w-8 h-8" />
                        <span className="text-[10px] font-bold uppercase">Brak logo</span>
                      </div>
                    )}
                    <label className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white cursor-pointer transition flex items-center gap-2">
                      <Upload className="w-3 h-3" />
                      {logoPreview || logoFile ? 'Zmień logo' : 'Wgraj logo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] || null;
                          setLogoFile(f);
                        }}
                      />
                    </label>
                    <p className="text-[9px] text-[#555] text-center">PNG, JPG, WebP, SVG<br />Zalecane: 200×60 px</p>
                  </div>
                </div>

                {/* Dane tekstowe firmy */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Nazwa Firmy</label>
                    <input
                      type="text"
                      value={siteSettings.site_name}
                      onChange={e => setSiteSettings(prev => ({ ...prev, site_name: e.target.value }))}
                      placeholder="np. Drift Park Extreme"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Adres Firmy</label>
                    <input
                      type="text"
                      value={siteSettings.site_address}
                      onChange={e => setSiteSettings(prev => ({ ...prev, site_address: e.target.value }))}
                      placeholder="np. ul. Torowa 12, 30-000 Kraków"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">NIP</label>
                    <input
                      type="text"
                      value={siteSettings.site_nip}
                      onChange={e => setSiteSettings(prev => ({ ...prev, site_nip: e.target.value }))}
                      placeholder="np. 123-456-78-90"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">REGON</label>
                    <input
                      type="text"
                      value={siteSettings.site_regon}
                      onChange={e => setSiteSettings(prev => ({ ...prev, site_regon: e.target.value }))}
                      placeholder="np. 123456789"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Telefon Kontaktowy</label>
                    <input
                      type="tel"
                      value={siteSettings.site_phone}
                      onChange={e => setSiteSettings(prev => ({ ...prev, site_phone: e.target.value }))}
                      placeholder="np. +48 123 456 789"
                      className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Ustawienia Operacyjne ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-brand-gold" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-400" />
                <span>Ustawienia Regionalne i Operacyjne</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Strefa Czasowa</label>
                  <select
                    value={siteSettings.site_timezone}
                    onChange={e => setSiteSettings(prev => ({ ...prev, site_timezone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="Europe/Warsaw">Europe/Warsaw (UTC+1/+2)</option>
                    <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                    <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Waluta</label>
                  <select
                    value={siteSettings.site_currency}
                    onChange={e => setSiteSettings(prev => ({ ...prev, site_currency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="PLN">PLN — złoty polski</option>
                    <option value="EUR">EUR — euro</option>
                    <option value="USD">USD — dolar amerykański</option>
                    <option value="GBP">GBP — funt brytyjski</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">Format Daty</label>
                  <select
                    value={siteSettings.site_date_format}
                    onChange={e => setSiteSettings(prev => ({ ...prev, site_date_format: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="DD.MM.YYYY">DD.MM.YYYY (np. 09.08.2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (np. 2026-08-09)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (np. 08/09/2026)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ---- Alerty Magazynowe ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                <span>Alerty Magazynowe</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Próg alertu terminu ważności (dni)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={siteSettings.alert_expiry_days}
                    onChange={e => setSiteSettings(prev => ({ ...prev, alert_expiry_days: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  />
                  <p className="mt-1 text-[10px] text-[#555] italic">Produkty wygasające w ciągu ilu dni mają pojawiać się w alertach (domyślnie: 30)</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Globalne alerty niskiego stanu
                  </label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.alert_low_stock_global === 'true'}
                        onChange={e => setSiteSettings(prev => ({ ...prev, alert_low_stock_global: e.target.checked ? 'true' : 'false' }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
                    </label>
                    <span className="text-xs text-[#a0a0a0]">
                      {siteSettings.alert_low_stock_global === 'true' ? 'Włączone — wyświetlane na dashboardzie' : 'Wyłączone'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Słowniki Magazynowe ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-brand-gold" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-green-400" />
                <span>Słowniki Magazynowe</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Domyślni Dostawcy (rozdzieleni przecinkami)
                  </label>
                  <textarea
                    rows={4}
                    value={siteSettings.warehouse_suppliers || ''}
                    onChange={e => setSiteSettings(prev => ({ ...prev, warehouse_suppliers: e.target.value }))}
                    placeholder="np. Makro, Allegro, Hurtownia opon, Inter Cars"
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                  <p className="mt-1 text-[10px] text-[#555] italic">Lista dostawców, którzy będą widoczni w rozwijanym menu podczas wprowadzania dostaw i produktów.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Miejsca przechowywania / Półki (rozdzielone przecinkami)
                  </label>
                  <textarea
                    rows={4}
                    value={siteSettings.warehouse_locations || ''}
                    onChange={e => setSiteSettings(prev => ({ ...prev, warehouse_locations: e.target.value }))}
                    placeholder="np. Półka A1, Półka B2, Lodówka 1, Zaplecze"
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                  <p className="mt-1 text-[10px] text-[#555] italic">Lista miejsc przechowywania i półek do przypisania produktom w katalogu.</p>
                </div>
              </div>
            </div>

            {/* ---- Bezpieczeństwo ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Bezpieczeństwo Sesji</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Czas wygaśnięcia sesji (godziny)
                  </label>
                  <select
                    value={siteSettings.security_session_hours}
                    onChange={e => setSiteSettings(prev => ({ ...prev, security_session_hours: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="4">4 godziny</option>
                    <option value="8">8 godzin (jedna zmiana)</option>
                    <option value="12">12 godzin</option>
                    <option value="24">24 godziny (domyślnie)</option>
                    <option value="72">3 dni</option>
                    <option value="168">1 tydzień</option>
                  </select>
                  <p className="mt-1 text-[10px] text-[#555] italic">Po tym czasie użytkownik musi zalogować się ponownie</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Wymusz zmianę hasła co (dni, 0 = wyłączone)
                  </label>
                  <select
                    value={siteSettings.security_force_password_days}
                    onChange={e => setSiteSettings(prev => ({ ...prev, security_force_password_days: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="0">Wyłączone</option>
                    <option value="30">Co 30 dni</option>
                    <option value="60">Co 60 dni</option>
                    <option value="90">Co 90 dni</option>
                    <option value="180">Co 180 dni</option>
                    <option value="365">Co rok</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Przycisk zapisu */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-8 py-3 bg-gradient-to-r from-brand-gold to-yellow-500 text-brand-dark font-black rounded-xl uppercase tracking-wider text-xs hover:opacity-95 transition cursor-pointer flex items-center gap-2 shadow-lg shadow-brand-gold/20"
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Zapisz Ustawienia Strony
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
