'use client';

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-[#a0a0a0] hover:text-white bg-[#1a1a1a] hover:bg-brand-red transition duration-200 cursor-pointer"
    >
      <LogOut className="w-4 h-4" />
      <span>Wyloguj się</span>
    </button>
  );
}
