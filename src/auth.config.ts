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

  console.warn(
    "[auth] AUTH_SECRET is not set. Using an ephemeral development secret. Set AUTH_SECRET before deploying."
  );
  if (!(globalThis as any).__devAuthSecret) {
    (globalThis as any).__devAuthSecret = randomBytes(32).toString("hex");
  }
  return (globalThis as any).__devAuthSecret as string;
}

/** Fail-closed: strip identity so Auth.js treats the session as logged out. */
function invalidateToken(token: Record<string, unknown>) {
  const cleared: Record<string, unknown> = { ...token };
  delete cleared.sub;
  delete cleared.email;
  delete cleared.name;
  delete cleared.picture;
  delete cleared.role;
  delete cleared.position;
  delete cleared.permissions;
  delete cleared.venueId;
  delete cleared.mustChangePassword;
  delete cleared.sessionVersion;
  delete cleared.rememberMe;
  cleared.isDemo = false;
  cleared.exp = 0;
  return cleared;
}

export const authConfig = {
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" ||
    Boolean(process.env.AUTH_URL || process.env.NEXTAUTH_URL) ||
    process.env.NODE_ENV !== "production",
  providers: [],
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
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
        }
      }

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
            console.warn("[auth] JWT rejected — user no longer exists");
            return invalidateToken(token as any) as typeof token;
          }

          const row = rows[0];
          const tokenVersion = Number(token.sessionVersion ?? 0);
          const dbVersion = Number(row.sessionVersion ?? 0);
          if (tokenVersion !== dbVersion) {
            console.warn("[auth] JWT rejected — sessionVersion mismatch");
            return invalidateToken(token as any) as typeof token;
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
          // Transient DB errors: fail closed to avoid serving stale elevated claims.
          console.error("[auth] Failed to refresh JWT claims from DB — invalidating session:", e);
          return invalidateToken(token as any) as typeof token;
        }
      }

      return token;
    },
    session({ session, token }) {
      // No sub => treat as unauthenticated session surface
      if (!token?.sub) {
        return { ...session, user: undefined as any };
      }
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
