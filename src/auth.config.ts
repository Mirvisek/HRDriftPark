import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Puste w konfiguracji bazowej (middleware nie wspiera Credentials)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.position = (user as any).position;
        token.isDemo = (user as any).isDemo;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.rememberMe = (user as any).rememberMe;
        
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
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "drift_park_extreme_secret_key_2026_nextauth_custom",
} satisfies NextAuthConfig;
