import type { NextAuthConfig } from "next-auth";

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const isProdRuntime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
if (!authSecret && isProdRuntime) {
  throw new Error("AUTH_SECRET (albo NEXTAUTH_SECRET) musi być ustawiony w produkcji.");
}

export const authConfig = {
  trustHost: true,
  providers: [], // Puste w konfiguracji bazowej (middleware nie wspiera Credentials)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.position = (user as any).position;
        token.isDemo = (user as any).isDemo;
        token.venueId = (user as any).venueId;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.rememberMe = (user as any).rememberMe;
        token.permissions = (user as any).permissions;
        token.sessionRowId = (user as any).sessionRowId ?? null;
        
        if (token.rememberMe === "true") {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 dni
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 godzin
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).position = token.position;
        (session.user as any).isDemo = token.isDemo;
        (session.user as any).venueId = token.venueId;
        (session.user as any).mustChangePassword = token.mustChangePassword;
        (session.user as any).permissions = token.permissions;
        (session.user as any).sessionRowId = token.sessionRowId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: authSecret || "dev-only-secret-not-for-production",
} satisfies NextAuthConfig;
