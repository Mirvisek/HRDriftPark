import type { NextAuthConfig } from "next-auth";
import { randomBytes } from "crypto";

function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set in production. Refusing to start with a hardcoded fallback."
    );
  }

  // Dev-only ephemeral secret — sessions reset on process restart.
  console.warn(
    "[auth] AUTH_SECRET is not set. Using an ephemeral development secret. Set AUTH_SECRET before deploying."
  );
  if (!(globalThis as any).__devAuthSecret) {
    (globalThis as any).__devAuthSecret = randomBytes(32).toString("hex");
  }
  return (globalThis as any).__devAuthSecret as string;
}

export const authConfig = {
  // Prefer AUTH_URL/NEXTAUTH_URL in production; allow explicit AUTH_TRUST_HOST=true behind proxies.
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" ||
    Boolean(process.env.AUTH_URL || process.env.NEXTAUTH_URL) ||
    process.env.NODE_ENV !== "production",
  providers: [], // Puste w konfiguracji bazowej (middleware nie wspiera Credentials)
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as any).role;
        token.position = (user as any).position;
        token.isDemo = (user as any).isDemo;
        token.venueId = (user as any).venueId;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.rememberMe = (user as any).rememberMe;
        token.permissions = (user as any).permissions;
        token.sessionVersion = (user as any).sessionVersion ?? 0;

        if (token.rememberMe === "true") {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 dni
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 godzin
        }
      }

      // Re-validate role/permissions/sessionVersion from DB so revocations take effect.
      // Throttle to once per 60s unless this is a fresh login.
      const now = Math.floor(Date.now() / 1000);
      const lastCheck = typeof token.lastAuthzCheck === "number" ? token.lastAuthzCheck : 0;
      const shouldRefresh = Boolean(user) || trigger === "update" || now - lastCheck >= 60;

      if (shouldRefresh && token.sub) {
        try {
          const { db } = await import("@/db");
          const { users } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          const rows = await db
            .select({
              role: users.role,
              position: users.position,
              isDemo: users.isDemo,
              venueId: users.venueId,
              mustChangePassword: users.mustChangePassword,
              permissions: users.permissions,
              sessionVersion: users.sessionVersion,
            })
            .from(users)
            .where(eq(users.id, Number(token.sub)))
            .limit(1);

          if (rows.length === 0) {
            throw new Error("User no longer exists");
          }

          const row = rows[0];
          const tokenVersion = Number(token.sessionVersion ?? 0);
          const dbVersion = Number(row.sessionVersion ?? 0);
          if (tokenVersion !== dbVersion) {
            throw new Error("Session invalidated");
          }

          token.role = row.role;
          token.position = row.position;
          token.isDemo = row.isDemo === true;
          token.venueId = row.venueId;
          token.mustChangePassword = row.mustChangePassword;
          token.permissions = row.permissions;
          token.sessionVersion = dbVersion;
          token.lastAuthzCheck = now;
        } catch (e) {
          console.error("[auth] Failed to refresh JWT claims from DB:", e);
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
        (session.user as any).sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: resolveAuthSecret(),
} satisfies NextAuthConfig;
