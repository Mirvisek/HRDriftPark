import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DemoBar } from "@/components/DemoBar";
import Link from "next/link";
import { Calendar, Clock, LayoutDashboard, CalendarDays, Flame, LogOut, User } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any).role;
  const isManagerOrOwner = role === "manager" || role === "owner";

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f] text-[#e0e0e0] font-sans">
      {/* Top Demo Bar */}
      <DemoBar />

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col p-6 shrink-0 justify-between">
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
              <Link
                href="/availability"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#1a1a1a] hover:text-brand-gold transition duration-200"
              >
                <CalendarDays className="w-4 h-4 text-brand-gold" />
                <span>Dyspozycyjność</span>
              </Link>
              <Link
                href="/schedule"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#1a1a1a] hover:text-brand-gold transition duration-200"
              >
                <Calendar className="w-4 h-4 text-brand-gold" />
                <span>Grafik Pracy</span>
              </Link>
              <Link
                href="/timesheet"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#1a1a1a] hover:text-brand-gold transition duration-200"
              >
                <Clock className="w-4 h-4 text-brand-gold" />
                <span>Karta Godzin</span>
              </Link>
              {isManagerOrOwner && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#1a1a1a] hover:text-brand-gold border border-brand-red/10 bg-brand-red/5 transition duration-200"
                >
                  <LayoutDashboard className="w-4 h-4 text-brand-red" />
                  <span className="text-white">Panel Menedżera</span>
                </Link>
              )}
            </nav>
          </div>

          {/* User Section & Logout */}
          <div className="pt-6 border-t border-white/5 mt-8 md:mt-0 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1e1e1e] flex items-center justify-center text-[#ffd700] border border-white/5">
                <User className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-white truncate">
                  {session.user.name}
                </div>
                <div className="text-xs text-[#a0a0a0] truncate capitalize">
                  {(session.user as any).position}
                </div>
              </div>
            </div>

            <SignOutButton />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-[#121212] p-6 md:p-10 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
