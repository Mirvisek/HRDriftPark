import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: 'owner' | 'manager' | 'employee';
      position: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: 'owner' | 'manager' | 'employee';
    position: string;
    isDemo: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: 'owner' | 'manager' | 'employee';
    position: string;
    isDemo: boolean;
  }
}
