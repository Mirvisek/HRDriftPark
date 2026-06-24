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
  Settings
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";

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
            )}
          </nav>
        </div>

        {/* User Section & Logout */}
        <div className="pt-6 border-t border-white/5 space-y-4">
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
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-white/5 text-white hover:text-brand-gold transition cursor-pointer"
            aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

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
