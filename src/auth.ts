import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { checkRateLimit } from "@/lib/rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Hasło", type: "password" },
        rememberMe: { label: "Zapamiętaj mnie", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const email = String(credentials.email || "").trim().toLowerCase();
        const password = String(credentials.password || "");

        if (!email || !password) return null;

        // 10 attempts / 15 min per email (and a coarser IP-agnostic global bucket key)
        const emailLimit = checkRateLimit(`login:email:${email}`, 10, 15 * 60 * 1000);
        if (!emailLimit.allowed) {
          console.warn(`[auth] Login rate-limited for ${email}`);
          return null;
        }

        try {
          const { db } = await import("@/db");
          const { users } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          const bcrypt = await import("bcryptjs");

          const dbUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (dbUsers.length > 0) {
            const user = dbUsers[0];
            const isValid = await bcrypt.compare(password, user.password);
            if (isValid) {
              return {
                id: String(user.id),
                name: user.displayName,
                email: user.email,
                role: user.role,
                position: user.position,
                mustChangePassword: user.mustChangePassword,
                isDemo: user.isDemo === true,
                venueId: user.venueId,
                permissions: user.permissions,
                sessionVersion: user.sessionVersion ?? 0,
                rememberMe: credentials.rememberMe === "true" ? "true" : "false",
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
