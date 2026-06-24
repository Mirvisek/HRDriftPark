'use client';

import { SessionProvider } from "next-auth/react";
import { InactivityLogout } from "@/components/InactivityLogout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <InactivityLogout />
    </SessionProvider>
  );
}

