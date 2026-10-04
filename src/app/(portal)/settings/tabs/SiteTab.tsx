'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Shield, 
  Calendar, 
  Check, 
  AlertCircle,
  Upload,
  ImageIcon,
  Bell,
  Clock,
  Palette,
  Layers,
  Save
} from 'lucide-react';
import { 
  getSettingsAction, 
  saveSettingsAction, 
  uploadLogoAction,
} from '@/app/actions/settingsActions';

export default function SiteTab() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

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
    sms_api_key: '',
    sms_sender_name: 'DriftPark',
    cron_availability_lock_day: '15',
    cron_reminder_hour: '20',
    require_delete_reason: 'true',
    template_push_msg: 'Witaj {imie}! Przypominamy o jutrzejszym dyżurze w lokalu {lokal} o {godzina_start}.',
    max_upload_size_mb: '10',
    sound_notifications_enabled: 'true',
    security_2fa_required: 'false',
    holiday_dates: '2026-01-01, 2026-01-06, 2026-04-05, 2026-04-06, 2026-05-01, 2026-05-03, 2026-06-04, 2026-08-15, 2026-11-01, 2026-11-11, 2026-12-25, 2026-12-26',
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const settingsRes = await getSettingsAction();
        if (settingsRes && settingsRes.success && settingsRes.settings) {
          setSiteSettings(prev => ({
            ...prev,
            ...settingsRes.settings
          }));
          if (settingsRes.settings.site_logo) {
            setLogoPreview(settingsRes.settings.site_logo);
          }
        }
      } catch (err) {
        console.error("Błąd ładowania ustawień strony:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Dwuetapowa weryfikacja 2FA (TOTP)
                  </label>
                  <select
                    value={siteSettings.security_2fa_required}
                    onChange={e => setSiteSettings(prev => ({ ...prev, security_2fa_required: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="false">Opcjonalna dla pracowników</option>
                    <option value="true">Wymagana dla kadry menedżerskiej</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Maksymalny rozmiar załączanych skanów/faktur (MB)
                  </label>
                  <input
                    type="number"
                    value={siteSettings.max_upload_size_mb}
                    onChange={e => setSiteSettings(prev => ({ ...prev, max_upload_size_mb: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  />
                </div>
              </div>
            </div>

            {/* ---- Integracja Bramki SMS ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>Integracja Bramki SMS (SMSAPI / Twilio)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Klucz API Bramki SMS
                  </label>
                  <input
                    type="password"
                    value={siteSettings.sms_api_key}
                    onChange={e => setSiteSettings(prev => ({ ...prev, sms_api_key: e.target.value }))}
                    placeholder="Wpisz token API (SMSAPI.pl lub Twilio)"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Nazwa nadawcy SMS (Pole Nadawcy)
                  </label>
                  <input
                    type="text"
                    value={siteSettings.sms_sender_name}
                    onChange={e => setSiteSettings(prev => ({ ...prev, sms_sender_name: e.target.value }))}
                    placeholder="np. DriftPark"
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  />
                </div>
              </div>
            </div>

            {/* ---- Harmonogram Zadań CRON i Automatyzacje ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Automatyzacje i Harmonogram CRON</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Dzień zamrażania edycji dyspozycyjności
                  </label>
                  <select
                    value={siteSettings.cron_availability_lock_day}
                    onChange={e => setSiteSettings(prev => ({ ...prev, cron_availability_lock_day: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="10">10-ty dzień miesiąca</option>
                    <option value="15">15-ty dzień miesiąca (domyślnie)</option>
                    <option value="20">20-ty dzień miesiąca</option>
                    <option value="25">25-ty dzień miesiąca</option>
                  </select>
                  <p className="mt-1 text-[10px] text-[#555] italic">Po tym dniu edycja własnej dostępności jest blokowana</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                    Godzina wysyłania przypomnień o dyżurze (CRON)
                  </label>
                  <select
                    value={siteSettings.cron_reminder_hour}
                    onChange={e => setSiteSettings(prev => ({ ...prev, cron_reminder_hour: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  >
                    <option value="18">18:00 Dzień wcześniej</option>
                    <option value="19">19:00 Dzień wcześniej</option>
                    <option value="20">20:00 Dzień wcześniej (domyślnie)</option>
                    <option value="21">21:00 Dzień wcześniej</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ---- Szablony Powiadomień z Taganmi ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-gold" />
                <span>Szablon Treści Powiadomień Przypominających</span>
              </h3>

              <div>
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                  Treść powiadomienia Push/SMS (Obsługiwane tagi: &#123;imie&#125;, &#123;data&#125;, &#123;godzina_start&#125;, &#123;lokal&#125;)
                </label>
                <textarea
                  rows={3}
                  value={siteSettings.template_push_msg}
                  onChange={e => setSiteSettings(prev => ({ ...prev, template_push_msg: e.target.value }))}
                  className="w-full p-3 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                />
              </div>
            </div>

            {/* ---- Kalendarz Świąt Państwowych ---- */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-white" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-red" />
                <span>Kalendarz Świąt i Dni Wolnych (Oznaczane w Grafiku)</span>
              </h3>

              <div>
                <label className="block text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                  Daty dni wolnych (Format YYYY-MM-DD rozdzielone przecinkami)
                </label>
                <textarea
                  rows={2}
                  value={siteSettings.holiday_dates}
                  onChange={e => setSiteSettings(prev => ({ ...prev, holiday_dates: e.target.value }))}
                  className="w-full p-3 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-mono"
                />
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
                    <Save className="w-4 h-4" />
                    <span>Zapisz Ustawienia Strony</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
  );
}
