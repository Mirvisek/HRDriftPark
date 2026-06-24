'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Flame, AlertCircle, CheckCircle2, Lock, HelpCircle, X, Calendar, Mail } from 'lucide-react';
import { forgotPasswordAction } from '@/app/actions/authActions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Stan modala "Przypomnij hasło"
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBirthDate, setForgotBirthDate] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  let searchParams: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch (e) {}

  useEffect(() => {
    if (searchParams) {
      const err = searchParams.get('error');
      const changed = searchParams.get('changed');
      const resetSuccess = searchParams.get('resetSuccess');

      if (err === 'CredentialsSignin') {
        setError('Niepoprawne dane logowania. Spróbuj ponownie.');
      } else if (err) {
        setError('Wystąpił błąd podczas logowania.');
      }

      if (changed === 'true') {
        setSuccessMsg('Hasło zostało pomyślnie zmienione! Zaloguj się przy użyciu nowego hasła.');
      } else if (resetSuccess === 'true') {
        setSuccessMsg('Hasło zostało zresetowane! Zaloguj się przy użyciu nowego hasła.');
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Wprowadź adres e-mail oraz hasło.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await signIn('credentials', {
        email,
        password,
        rememberMe: rememberMe ? 'true' : 'false',
        callbackUrl: '/availability',
      });
    } catch (err) {
      setError('Błąd serwera logowania.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotEmail || !forgotBirthDate) {
      setForgotError('Uzupełnij adres e-mail oraz datę urodzenia.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPasswordAction(forgotEmail, forgotBirthDate);
      if (res.success) {
        setForgotSuccess(res.message || 'Link do restartu hasła został wysłany! Jeżeli nie posiadasz konta skontaktuj się z administratorem!');
        setForgotEmail('');
        setForgotBirthDate('');
      } else {
        setForgotError(res.error || 'Wystąpił błąd podczas resetowania.');
      }
    } catch (err) {
      setForgotError('Błąd połączenia z serwerem.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative bg-[#0a0a0a] px-4 overflow-hidden py-12">
      {/* Tło dekoracyjne */}
      <div className="absolute inset-0 racing-stripes-subtle opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-gold/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo i Nagłówek */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-brand-red to-brand-gold rounded-2xl flex items-center justify-center shadow-lg shadow-brand-red/20 mb-4 transform -rotate-6">
            <Flame className="w-10 h-10 text-brand-dark fill-brand-dark" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
            DRIFT PARK <span className="text-brand-gold">EXTREME</span>
          </h1>
          <p className="text-xs text-[#a0a0a0] uppercase tracking-widest mt-1">
            Panel Zarządzania Czasem Pracy
          </p>
        </div>

        {/* Karta Logowania */}
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
          {/* Ozdobny pasek u góry */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
          
          <h2 className="text-xl font-bold text-white mb-6">Logowanie</h2>

          {successMsg && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                Adres e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nazwa@driftpark.pl"
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                Hasło
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
              />
            </div>

            {/* Opcje dodatkowe: Zapamiętaj mnie i Zapomniałem hasła */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-[#a0a0a0] cursor-pointer hover:text-white transition select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-[#1a1a1a] border-white/10 text-brand-gold focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                />
                <span>Zapamiętaj mnie</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="text-brand-gold hover:underline font-semibold cursor-pointer"
              >
                Zapomniałeś hasła?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-brand-red/20 transition duration-300 disabled:opacity-50 cursor-pointer text-center font-display uppercase tracking-wider text-sm"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>
        </div>

        {/* Prawa autorskie */}
        <p className="text-center text-[10px] text-[#555] mt-6">
          Drift Park Extreme © 2026. Wszystkie prawa zastrzeżone.
        </p>
      </div>

      {/* MODAL: Przypomnij hasło */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-md rounded-2xl relative overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            
            {/* Przycisk zamknięcia */}
            <button
              onClick={() => setForgotOpen(false)}
              className="absolute right-4 top-4 text-[#a0a0a0] hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Przywróć dostęp</h3>
                  <p className="text-[10px] text-[#a0a0a0]">Krok 1: Weryfikacja tożsamości</p>
                </div>
              </div>

              {forgotSuccess ? (
                <div className="space-y-4 py-4 text-center">
                  <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-[#e0e0e0] font-medium leading-relaxed">
                    {forgotSuccess}
                  </p>
                  <button
                    onClick={() => setForgotOpen(false)}
                    className="mt-4 px-6 py-2 bg-[#1e1e1e] hover:bg-[#252525] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Zamknij okno
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-[#a0a0a0] leading-relaxed">
                    W celach weryfikacyjnych podaj swój adres e-mail oraz dokładną datę urodzenia zapisaną w Twoim profilu.
                  </p>

                  {forgotError && (
                    <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                      Adres e-mail
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Twój adres e-mail"
                        className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      />
                      <Mail className="w-3.5 h-3.5 text-[#555] absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wider mb-1.5">
                      Data urodzenia
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={forgotBirthDate}
                        onChange={(e) => setForgotBirthDate(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      />
                      <Calendar className="w-3.5 h-3.5 text-[#555] absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full mt-4 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark font-black rounded-lg text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark"></div>
                    ) : (
                      'Przywróć dostęp'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
