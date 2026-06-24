import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        
        const { email, password } = credentials;
        
        // Standardowa autoryzacja za pomocą bazy danych
        try {
          const { db } = await import("@/db");
          const { users } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          const bcrypt = await import("bcryptjs");
          
          const dbUsers = await db.select().from(users).where(eq(users.email, String(email))).limit(1);
          if (dbUsers.length > 0) {
            const user = dbUsers[0];
            const isValid = await bcrypt.compare(String(password), user.password);
            if (isValid) {
              return {
                id: String(user.id),
                name: user.displayName, // Używamy displayName jako name w sesji
                email: user.email,
                role: user.role,
                position: user.position,
                mustChangePassword: user.mustChangePassword,
                isDemo: user.isDemo,
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
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.position = (user as any).position;
        token.isDemo = (user as any).isDemo;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.rememberMe = (user as any).rememberMe;
        
        // Dynamiczne ustawienie czasu życia sesji w zależności od wyboru użytkownika
        if (token.rememberMe === "true") {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 dni
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 godzin (sesja krótka)
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
});
