'use client';

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { Clock, AlertTriangle, LogOut } from "lucide-react";

// Czas bezczynności przed pokazaniem ostrzeżenia: 9 minut (540 000 ms)
const INACTIVITY_TIMEOUT = 9 * 60 * 1000; 
// Czas trwania ostrzeżenia z odliczaniem: 60 sekund (60 000 ms)
const WARNING_TIMEOUT = 60 * 1000;

export function InactivityLogout() {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Wskaźnik czy użytkownik jest zalogowany
  const isAuthenticated = status === 'authenticated' && session?.user;

  // Resetuje licznik bezczynności
  const resetInactivityTimer = () => {
    if (showWarning) return; // Jeśli modal jest już otwarty, nie resetujemy ruchami myszy
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (isAuthenticated) {
      inactivityTimerRef.current = setTimeout(() => {
        // Po okresie bezczynności pokazujemy ostrzeżenie
        setShowWarning(true);
        setSecondsRemaining(60);
      }, INACTIVITY_TIMEOUT);
    }
  };

  // Obsługa kliknięcia "Przedłuż sesję"
  const handleExtendSession = () => {
    setShowWarning(false);
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
    }
    resetInactivityTimer();
  };

  // Obsługa natychmiastowego wylogowania
  const handleLogout = async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    setShowWarning(false);
    await signOut({ callbackUrl: "/login" });
  };

  // Monitorowanie aktywności użytkownika
  useEffect(() => {
    if (!isAuthenticated) {
      // Jeśli użytkownik nie jest zalogowany, czyścimy wszystko i wychodzimy
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      setShowWarning(false);
      return;
    }

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    
    // Dodajemy nasłuchiwanie zdarzeń aktywności
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    // Inicjalne uruchomienie timera
    resetInactivityTimer();

    return () => {
      // Czyszczenie zdarzeń i timerów przy odmontowywaniu
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    };
  }, [isAuthenticated, showWarning]);

  // Licznik czasu ostrzeżenia
  useEffect(() => {
    if (showWarning && isAuthenticated) {
      warningIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            // Czas minął – wylogowanie
            clearInterval(warningIntervalRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
      }
    };
  }, [showWarning, isAuthenticated]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-[#0a0a0a]/95 border border-brand-red/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-brand-red/10 relative text-center space-y-6">
        {/* Neon Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red rounded-t-2xl" />
        
        {/* Icon */}
        <div className="w-16 h-16 bg-brand-red/10 border border-brand-red/20 rounded-full flex items-center justify-center mx-auto text-brand-red shadow-[0_0_15px_rgba(255,51,51,0.2)]">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-display">Sesja wygasa</h3>
          <p className="text-sm text-[#a0a0a0] leading-relaxed">
            Nie odnotowano aktywności od dłuższego czasu. Zostaniesz automatycznie wylogowany z przyczyn bezpieczeństwa.
          </p>
        </div>

        {/* Countdown */}
        <div className="py-4 flex flex-col items-center justify-center">
          <div className="text-5xl font-black font-display text-white tracking-tight flex items-baseline justify-center">
            <span className="text-brand-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]">{secondsRemaining}</span>
            <span className="text-xs text-[#888] font-bold uppercase tracking-wider ml-1">sekund</span>
          </div>
          <p className="text-[10px] text-[#555] uppercase tracking-widest mt-2">Pozostały czas na reakcję</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleExtendSession}
            className="w-full py-3 bg-gradient-to-r from-brand-red to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-brand-red/20 transition duration-300 cursor-pointer text-sm font-display flex items-center justify-center gap-2"
          >
            <span>Przedłuż sesję</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full py-2.5 text-xs text-[#a0a0a0] hover:text-brand-red hover:bg-brand-red/5 rounded-lg border border-transparent hover:border-brand-red/10 transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Wyloguj teraz</span>
          </button>
        </div>
      </div>
    </div>
  );
}
