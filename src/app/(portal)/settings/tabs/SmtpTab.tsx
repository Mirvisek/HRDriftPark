'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Shield, 
  Info, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  ClipboardList,
} from 'lucide-react';
import { 
  getSettingsAction, 
  saveSettingsAction, 
  testSmtpConnectionAction,
} from '@/app/actions/settingsActions';

export default function SmtpTab() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const settingsRes = await getSettingsAction();
        if (settingsRes && settingsRes.success && settingsRes.settings) {
          setSmtpSettings(prev => ({
            ...prev,
            ...settingsRes.settings
          }));
        }
      } catch (err) {
        console.error("Błąd ładowania ustawień SMTP:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
    </div>
  );
}
