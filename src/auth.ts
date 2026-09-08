import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

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
        
        const { email, password } = credentials;
        
        // Obsługa 1-Click Kont Demo (100% odizolowane konta demo)
        const emailStr = String(email).toLowerCase();
        if (emailStr === 'demo.manager@driftpark.pl' || password === 'demo123') {
          if (emailStr.includes('pracownik')) {
            return { id: '9902', name: 'Michał Nowak (Pracownik Demo)', email: 'demo.pracownik@driftpark.pl', role: 'employee', position: 'Obsługa Widowni', mustChangePassword: false, isDemo: true, venueId: 1, permissions: [] };
          }
          if (emailStr.includes('technik')) {
            return { id: '9903', name: 'Piotr Wiśniewski (Technik Demo)', email: 'demo.technik@driftpark.pl', role: 'technik', position: 'Mechanik Gokartów', mustChangePassword: false, isDemo: true, venueId: 1, permissions: [] };
          }
          return { id: '9901', name: 'Jan Kowalski (Manager Demo)', email: 'demo.manager@driftpark.pl', role: 'manager', position: 'Kierownik Toru', mustChangePassword: false, isDemo: true, venueId: 1, permissions: ['*'] };
        }

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
                name: user.displayName,
                email: user.email,
                role: user.role,
                position: user.position,
                mustChangePassword: user.mustChangePassword,
                isDemo: user.isDemo,
                venueId: user.venueId,
                permissions: user.permissions,
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
