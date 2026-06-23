import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Hasło", type: "password" },
        isDemo: { label: "Is Demo", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        
        const { email, password, isDemo } = credentials;
        
        // Obsługa kont demo
        if (
          isDemo === "true" ||
          email === "owner@driftpark.pl" ||
          email === "manager@driftpark.pl" ||
          email === "pracownik@driftpark.pl"
        ) {
          if (email === "owner@driftpark.pl") {
            return {
              id: "demo-owner-id",
              name: "Jan Kowalski",
              email: "owner@driftpark.pl",
              role: "owner",
              position: "Właściciel",
              isDemo: true,
            };
          } else if (email === "manager@driftpark.pl") {
            return {
              id: "demo-manager-id",
              name: "Marek Nowak",
              email: "manager@driftpark.pl",
              role: "manager",
              position: "Menedżer Toru",
              isDemo: true,
            };
          } else if (email === "pracownik@driftpark.pl") {
            return {
              id: "demo-employee-id",
              name: "Adam Wiśniewski",
              email: "pracownik@driftpark.pl",
              role: "employee",
              position: "Instruktor Driftu",
              isDemo: true,
            };
          }
        }
        
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
                name: user.name,
                email: user.email,
                role: user.role,
                position: user.position,
                isDemo: user.isDemo,
              };
            }
          }
        } catch (e) {
          console.error("Błąd połączenia z bazą danych podczas logowania, fallback do kont demo:", e);
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).position = token.position;
        (session.user as any).isDemo = token.isDemo;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "drift_park_extreme_secret_key_2026_nextauth_custom",
});
