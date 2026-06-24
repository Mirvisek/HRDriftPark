'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Flame, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { changePasswordAction } from '@/app/actions/authActions';

export default function ChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ochrona trasy
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !(session?.user as any)?.mustChangePassword) {
      router.push('/availability');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-gold"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (status === 'authenticated' && !(session?.user as any)?.mustChangePassword)) {
    return null; // Zapobiega miganiu treści podczas przekierowania
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Uzupełnij oba pola hasła.');
      return;
    }

    if (password.length < 6) {
      setError('Hasło musi składać się z co najmniej 6 znaków.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Wprowadzone hasła różnią się od siebie.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePasswordAction(password);
      if (res.success) {
        setSuccess(true);
        // Automatyczne wylogowanie po 3 sekundach, aby zalogować się ponownie nowym hasłem
        setTimeout(async () => {
          await signOut({ callbackUrl: '/login?changed=true' });
        }, 3000);
      } else {
        setError(res.error || 'Wystąpił błąd podczas zmiany hasła.');
      }
    } catch (err) {
      setError('Błąd komunikacji z serwerem.');
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
            Wymagana zmiana hasła
          </p>
        </div>

        {/* Karta */}
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
          
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Hasło zostało zmienione!</h2>
              <p className="text-sm text-[#a0a0a0] leading-relaxed">
                Pomyślnie zaktualizowano Twoje hasło w systemie.<br />
                Za chwilę nastąpi automatyczne wylogowanie. Zaloguj się ponownie nowym hasłem.
              </p>
              <div className="pt-2">
                <div className="animate-pulse text-xs text-brand-gold font-bold">
                  Przekierowanie do ekranu logowania...
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-brand-gold" />
                  <span>Pierwsze logowanie</span>
                </h2>
                <p className="text-xs text-[#a0a0a0] mt-2 leading-relaxed">
                  Twoje konto zostało utworzone przez administratora z hasłem tymczasowym. Przed pierwszym użyciem systemu musisz ustawić własne, bezpieczne hasło.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-lg flex items-center gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                    Nowe hasło
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 znaków"
                      disabled={loading}
                      className="w-full pl-4 pr-10 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider mb-2">
                    Powtórz nowe hasło
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Powtórz hasło"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
                  />
                </div>

                <div className="text-[10px] text-[#888] leading-normal">
                  Wskazówka: Hasło powinno składać się z liter, cyfr i znaków specjalnych dla zapewnienia maksymalnego bezpieczeństwa Twojego konta.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-brand-red to-brand-gold hover:from-brand-red/90 hover:to-brand-gold/90 text-brand-dark font-black rounded-lg transition transform hover:-translate-y-0.5 active:translate-y-0 duration-150 cursor-pointer text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-brand-dark"></div>
                  ) : (
                    'Zapisz nowe hasło'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
