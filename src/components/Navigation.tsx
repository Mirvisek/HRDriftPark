'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  Calendar, 
  Clock, 
  LayoutDashboard, 
  CalendarDays, 
  Flame, 
  LogOut, 
  User, 
  Menu, 
  X,
  Settings,
  ClipboardList,
  DollarSign,
  Bell
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { getNotifications, markNotificationsAsReadAction } from "@/app/actions/userActions";

interface NavigationProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    position?: string;
  };
}

export function Navigation({ user }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const role = user.role;
  const isManagerOrOwner = role === "manager" || role === "owner" || role === "technik";

  // Zamykanie menu po zmianie podstrony
  useEffect(() => {
    setIsOpen(false);
    setShowNotifications(false);
  }, [pathname]);

  // Zapobieganie przewijaniu tła, gdy menu mobilne jest otwarte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notificationsList.filter(n => !n.isRead).length;

  const loadNotifications = async () => {
    const res = await getNotifications();
    if (res.success && res.data) {
      setNotificationsList(res.data);
    }
  };

  const handleMarkAsRead = async () => {
    setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })));
    await markNotificationsAsReadAction();
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    {
      href: "/availability",
      label: "Dyspozycyjność",
      icon: CalendarDays,
    },
    {
      href: "/schedule",
      label: "Grafik Pracy",
      icon: Calendar,
    },
    {
      href: "/timesheet",
      label: "Karta Godzin",
      icon: Clock,
    },
    {
      href: "/tasks",
      label: "Zadania",
      icon: ClipboardList,
    },
  ];

  const handleQuickLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR                                                           */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0a0a] border-r border-white/5 p-6 justify-between shrink-0 h-screen sticky top-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-brand-red to-brand-gold rounded-xl flex items-center justify-center shadow-lg shadow-brand-red/10 transform -rotate-3">
              <Flame className="w-6 h-6 text-brand-dark fill-brand-dark" />
            </div>
            <div>
              <h1 className="font-extrabold tracking-tight text-white text-md font-display">
                DRIFT PARK <span className="text-brand-gold">EXTREME</span>
              </h1>
              <p className="text-[10px] text-[#555] uppercase tracking-wider">
                System Czasu Pracy
              </p>
            </div>
          </div>

          {/* Menu Links */}
          <nav className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition duration-200 ${
                    isActive
                      ? "bg-[#1a1a1a] text-brand-gold border-l-2 border-brand-gold font-semibold"
                      : "text-[#a0a0a0] hover:bg-[#1a1a1a]/50 hover:text-brand-gold"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-brand-gold" : "text-[#888]"}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            
            {isManagerOrOwner && (
              <>
                <Link
                  href="/admin/payroll"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium border transition duration-200 ${
                    pathname === "/admin/payroll"
                      ? "bg-green-500/10 border-green-500/30 text-green-400 font-semibold"
                      : "border-green-500/10 bg-green-500/5 text-[#e0e0e0] hover:bg-green-500/10 hover:border-green-500/20"
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span>Rozliczenia płac</span>
                </Link>
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium border transition duration-200 ${
                    pathname === "/admin"
                      ? "bg-brand-red/10 border-brand-red/30 text-white font-semibold"
                      : "border-brand-red/10 bg-brand-red/5 text-[#e0e0e0] hover:bg-brand-red/10 hover:border-brand-red/20"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-red" />
                  <span>Panel Menedżera</span>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User Section & Logout */}
        <div className="pt-6 border-t border-white/5 space-y-3 relative">
          
          {/* Dzwoneczek Powiadomień */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium transition duration-200 cursor-pointer ${
                showNotifications 
                  ? "bg-white/10 text-white font-semibold" 
                  : "text-[#a0a0a0] hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="relative">
                <Bell className="w-4 h-4 text-brand-gold" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-red text-white text-[9px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span>Powiadomienia</span>
            </button>

            {/* Drop-up panel z powiadomieniami */}
            {showNotifications && (
              <div className="absolute bottom-12 left-0 w-80 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl p-4 z-50 space-y-3 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="font-bold text-xs text-white uppercase tracking-wider">Powiadomienia</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAsRead}
                      className="text-[10px] text-brand-gold hover:underline cursor-pointer font-semibold"
                    >
                      Oznacz jako przeczytane
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2.5 scrollbar-thin">
                  {notificationsList.length === 0 ? (
                    <div className="text-center text-xs text-[#555] py-4 italic">Brak powiadomień.</div>
                  ) : (
                    notificationsList.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-2.5 rounded-lg border text-xs transition flex gap-2 items-start ${
                          n.isRead 
                            ? 'bg-[#121212]/30 border-white/5 text-[#888]' 
                            : 'bg-white/[0.02] border-brand-gold/10 text-[#e0e0e0]'
                        }`}
                      >
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                        )}
                        <div className="space-y-1">
                          <p className="leading-relaxed">{n.message}</p>
                          <span className="text-[9px] text-[#555] block">
                            {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {(role === "owner" || role === "technik") && (
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 ${
                pathname === "/settings"
                  ? "bg-white/10 text-white font-semibold"
                  : "text-[#a0a0a0] hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4 text-brand-gold animate-pulse" />
              <span>Ustawienia strony</span>
            </Link>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1e1e1e] flex items-center justify-center text-[#ffd700] border border-white/5 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-white truncate">
                {user.name}
              </div>
              <div className="text-xs text-[#a0a0a0] truncate capitalize">
                {user.position}
              </div>
            </div>
          </div>

          <SignOutButton />
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE HEADER                                                             */}
      {/* ========================================================================= */}
      <header className="flex md:hidden items-center justify-between bg-[#0a0a0a] border-b border-white/5 px-6 py-4 sticky top-0 z-40 w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-brand-red to-brand-gold rounded-lg flex items-center justify-center shadow-md shadow-brand-red/10">
            <Flame className="w-5 h-5 text-brand-dark fill-brand-dark" />
          </div>
          <div>
            <h1 className="font-extrabold tracking-tight text-white text-xs font-display">
              DRIFT PARK <span className="text-brand-gold font-black">EXTREME</span>
            </h1>
          </div>
        </div>

        {/* Mobile quick controls */}
        <div className="flex items-center gap-3">
          {/* Dzwoneczek mobilny */}
          <button
            onClick={() => { setShowNotifications(!showNotifications); setIsOpen(false); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-white/5 transition cursor-pointer relative ${
              showNotifications ? 'text-brand-gold bg-white/10' : 'text-[#a0a0a0] hover:text-brand-gold'
            }`}
            title="Powiadomienia"
          >
            <Bell className="w-4 h-4 text-brand-gold" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-red text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Logout Button */}
          <button
            onClick={handleQuickLogout}
            title="Wyloguj się"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-white/5 text-[#a0a0a0] hover:text-brand-red hover:bg-brand-red/10 hover:border-brand-red/20 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
          
          {/* Hamburger toggle */}
          <button
            onClick={() => { setIsOpen(!isOpen); setShowNotifications(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-white/5 text-white hover:text-brand-gold transition cursor-pointer"
            aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE NOTIFICATIONS DRAWER OVERLAY */}
      {showNotifications && (
        <div className="fixed inset-x-0 bottom-0 top-[69px] bg-[#0a0a0a]/98 backdrop-blur-xl z-30 flex flex-col justify-between p-6 border-t border-white/5 animate-fade-in md:hidden">
          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
              <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-gold" />
                <span>Powiadomienia</span>
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAsRead}
                  className="text-xs text-brand-gold hover:underline cursor-pointer font-bold"
                >
                  Odznacz jako przeczytane
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3.5 min-h-0 pb-12">
              {notificationsList.length === 0 ? (
                <div className="text-center text-xs text-[#555] py-8 italic">Brak nowych powiadomień.</div>
              ) : (
                notificationsList.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-3.5 rounded-xl border text-xs transition flex gap-2.5 items-start ${
                      n.isRead 
                        ? 'bg-[#121212]/30 border-white/5 text-[#666]' 
                        : 'bg-white/[0.02] border-brand-gold/15 text-[#e0e0e0]'
                    }`}
                  >
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className="leading-relaxed font-semibold">{n.message}</p>
                      <span className="text-[10px] text-[#555] block">
                        {new Date(n.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <button
            onClick={() => setShowNotifications(false)}
            className="w-full py-3 bg-[#222] hover:bg-[#333] text-white text-xs font-extrabold rounded-xl uppercase tracking-wider transition cursor-pointer shrink-0 mt-4"
          >
            Zamknij powiadomienia
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE DRAWER OVERLAY                                                     */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[69px] bg-[#0a0a0a]/98 backdrop-blur-xl z-30 flex flex-col justify-between p-6 border-t border-white/5 animate-fade-in md:hidden">
          <div className="space-y-6">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Nawigacja</p>
            
            {/* Mobile Nav Links */}
            <nav className="space-y-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-md font-semibold transition ${
                      isActive
                        ? "bg-[#1a1a1a] text-brand-gold border-l-4 border-brand-gold"
                        : "text-[#a0a0a0] hover:bg-[#1a1a1a]/40 hover:text-brand-gold"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-brand-gold" : "text-[#666]"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {isManagerOrOwner && (
                <>
                  <Link
                    href="/admin/payroll"
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-md font-semibold border transition ${
                      pathname === "/admin/payroll"
                        ? "bg-green-500/10 border-green-500/30 text-green-400 font-semibold"
                        : "border-green-500/10 bg-green-500/5 text-[#e0e0e0] hover:bg-green-500/15"
                    }`}
                  >
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <span>Rozliczenia płac</span>
                  </Link>
                  <Link
                    href="/admin"
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-md font-semibold border transition ${
                      pathname === "/admin"
                        ? "bg-brand-red/10 border-brand-red/30 text-white"
                        : "border-brand-red/10 bg-brand-red/5 text-[#e0e0e0] hover:bg-brand-red/15"
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5 text-brand-red" />
                    <span>Panel Menedżera</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Mobile User Profile & Logout */}
          <div className="space-y-4 pt-6 border-t border-white/5">
            {(role === "owner" || role === "technik") && (
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-md font-semibold border transition ${
                  pathname === "/settings"
                    ? "bg-brand-gold/10 border-brand-gold/30 text-white"
                    : "border-brand-gold/10 bg-brand-gold/5 text-[#e0e0e0] hover:bg-brand-gold/15"
                }`}
              >
                <Settings className="w-5 h-5 text-brand-gold" />
                <span>Ustawienia strony</span>
              </Link>
            )}

            <div className="flex items-center gap-3 bg-[#121212] p-4 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#1e1e1e] flex items-center justify-center text-[#ffd700] border border-white/5 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-bold text-white truncate">
                  {user.name}
                </div>
                <div className="text-xs text-[#a0a0a0] truncate capitalize">
                  {user.position}
                </div>
              </div>
            </div>

            <SignOutButton />
          </div>
        </div>
      )}
    </>
  );
}
