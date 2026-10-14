import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { rateLimit } from "@/lib/rateLimit";
import { isSessionRowActive, loadAccount, openUserSession } from "@/lib/sessionGuard";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      const baseSession = await authConfig.callbacks.session({ session, token } as any);
      if (!baseSession?.user) return baseSession;

      const userId = Number(token.sub);
      if (!userId) return null as any;

      const rowId = Number(token.sessionRowId || 0);
      if (!(await isSessionRowActive(rowId))) return null as any;

      try {
        const account = await loadAccount(userId);
        if (!account) return null as any;
        baseSession.user.name = account.displayName;
        baseSession.user.email = account.email;
        (baseSession.user as any).id = String(account.id);
        (baseSession.user as any).role = account.role;
        (baseSession.user as any).position = account.position;
        (baseSession.user as any).venueId = account.venueId;
        (baseSession.user as any).permissions = account.permissions;
        (baseSession.user as any).mustChangePassword = account.mustChangePassword;
        (baseSession.user as any).isDemo = account.isDemo;
        (baseSession.user as any).sessionRowId = rowId || null;
      } catch (e) {
        console.error("[session] Nie odświeżono konta z bazy:", e);
      }

      return baseSession;
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Hasło", type: "password" },
        rememberMe: { label: "Zapamiętaj mnie", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials) return null;
        
        const { email, password } = credentials;
        const emailKey = String(email || "").trim().toLowerCase();
        if (!emailKey || !rateLimit(`login:${emailKey}`, 10, 15 * 60 * 1000)) {
          return null;
        }

        try {
          const { db } = await import("@/db");
          const { users } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          const bcrypt = await import("bcryptjs");
          
          const dbUsers = await db.select().from(users).where(eq(users.email, emailKey)).limit(1);
          if (dbUsers.length > 0) {
            const user = dbUsers[0];
            const isValid = await bcrypt.compare(String(password), user.password);
            if (isValid) {
              const remember = credentials.rememberMe === "true";
              const headerBag = request?.headers;
              const forwarded = headerBag?.get?.("x-forwarded-for");
              const sessionRowId = await openUserSession({
                userId: user.id,
                remember,
                userAgent: headerBag?.get?.("user-agent") ?? null,
                ipAddress: forwarded ? forwarded.split(",")[0].trim() : null,
              });
              return {
                id: String(user.id),
                name: user.displayName,
                email: user.email,
                role: user.role,
                position: user.position,
                mustChangePassword: user.mustChangePassword,
                isDemo: user.isDemo,
                venueId: user.venueId,
                permissions: user.permissions,
                rememberMe: remember ? "true" : "false",
                sessionRowId,
              };
            }
          }
        } catch (e) {
          console.error("Błąd połączenia z bazą danych podczas logowania:", e);
        }
        
        return null;
      },
    }),
  ],
});
