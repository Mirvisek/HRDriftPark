'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Shield, User, Users, Flame, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  // We should import useSearchParams from next/navigation
  let searchParams: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch (e) {}

  useEffect(() => {
    if (searchParams) {
      const err = searchParams.get('error');
      if (err === 'CredentialsSignin') {
        setError('Niepoprawne dane logowania. Spróbuj ponownie.');
      } else if (err) {
        setError('Wystąpił błąd podczas logowania.');
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
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: '/availability',
      });
    } catch (err) {
      setError('Błąd serwera logowania.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (roleEmail: string, roleName: string) => {
    setError(null);
    setLoadingRole(roleName);
    try {
      await signIn('credentials', {
        email: roleEmail,
        password: 'demo',
        isDemo: 'true',
        callbackUrl: '/availability',
      });
    } catch (err) {
      setError('Nie udało się uruchomić trybu demo.');
      setLoadingRole(null);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative bg-[#0a0a0a] px-4 overflow-hidden py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 racing-stripes-subtle opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-gold/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo and Header */}
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

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
          {/* Neon accent top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
          
          <h2 className="text-xl font-bold text-white mb-6">Logowanie</h2>

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

            <button
              type="submit"
              disabled={loading || loadingRole !== null}
              className="w-full py-3 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-brand-red/20 transition duration-300 disabled:opacity-50 cursor-pointer text-center"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center justify-between">
            <span className="h-[1px] bg-white/10 w-full" />
            <span className="text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wider px-3 whitespace-nowrap">
              Wypróbuj Demo
            </span>
            <span className="h-[1px] bg-white/10 w-full" />
          </div>

          {/* Demo Section */}
          <div className="space-y-3">
            <button
              onClick={() => handleDemoLogin('owner@driftpark.pl', 'Właściciel')}
              disabled={loading || loadingRole !== null}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 hover:border-brand-gold/30 rounded-lg text-white transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center text-brand-gold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-brand-gold transition">
                    Właściciel
                  </div>
                  <div className="text-[11px] text-[#a0a0a0]">Pełne uprawnienia systemu</div>
                </div>
              </div>
              <span className="text-xs text-[#a0a0a0] group-hover:text-brand-gold transition">
                {loadingRole === 'Właściciel' ? 'Ładowanie...' : 'Wybierz →'}
              </span>
            </button>

            <button
              onClick={() => handleDemoLogin('manager@driftpark.pl', 'Manager')}
              disabled={loading || loadingRole !== null}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 hover:border-brand-gold/30 rounded-lg text-white transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-orange-500 transition">
                    Manager
                  </div>
                  <div className="text-[11px] text-[#a0a0a0]">Zarządzanie pracownikami i grafikami</div>
                </div>
              </div>
              <span className="text-xs text-[#a0a0a0] group-hover:text-orange-500 transition">
                {loadingRole === 'Manager' ? 'Ładowanie...' : 'Wybierz →'}
              </span>
            </button>

            <button
              onClick={() => handleDemoLogin('pracownik@driftpark.pl', 'Pracownik')}
              disabled={loading || loadingRole !== null}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 hover:border-brand-gold/30 rounded-lg text-white transition text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">
                    Pracownik
                  </div>
                  <div className="text-[11px] text-[#a0a0a0]">Wprowadzanie dyspozycyjności i godzin</div>
                </div>
              </div>
              <span className="text-xs text-[#a0a0a0] group-hover:text-blue-400 transition">
                {loadingRole === 'Pracownik' ? 'Ładowanie...' : 'Wybierz →'}
              </span>
            </button>
          </div>
        </div>

        {/* Warning label */}
        <p className="text-center text-[10px] text-[#555] mt-6">
          Wersja demonstracyjna posiada izolowane mocki powiadomień i e-maili.<br />
          Drift Park Extreme © 2026. Wszystkie prawa zastrzeżone.
        </p>
      </div>
    </main>
  );
}
