'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Flame, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await signIn('credentials', {
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
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg hover:shadow-brand-red/20 transition duration-300 disabled:opacity-50 cursor-pointer text-center font-display"
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
    </main>
  );
}

