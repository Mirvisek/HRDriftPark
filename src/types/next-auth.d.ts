import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: 'owner' | 'manager' | 'employee' | 'technik';
      position: string;
      isDemo: boolean;
      venueId?: number | null;
      mustChangePassword?: boolean;
      permissions?: string | string[];
      sessionVersion?: number;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: 'owner' | 'manager' | 'employee' | 'technik';
    position: string;
    isDemo: boolean;
    venueId?: number | null;
    mustChangePassword?: boolean;
    permissions?: string | string[];
    sessionVersion?: number;
    rememberMe?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: 'owner' | 'manager' | 'employee' | 'technik';
    position: string;
    isDemo: boolean;
    venueId?: number | null;
    mustChangePassword?: boolean;
    permissions?: string | string[];
    sessionVersion?: number;
    rememberMe?: string;
    lastAuthzCheck?: number;
  }
}
