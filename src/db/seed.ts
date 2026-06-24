import fs from 'fs';
import path from 'path';

// 1. Ręczne załadowanie zmiennych środowiskowych z pliku .env w katalogu głównym
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key) {
        process.env[key.trim()] = values.join('=').trim();
      }
    }
  });
  console.log("Załadowano konfigurację z pliku .env");
} else {
  console.warn("Brak pliku .env. Używam domyślnych wartości.");
}

// 2. Import bazy danych i schematów po załadowaniu env
import { db } from "./index";
import { users } from "./schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Rozpoczynam seedowanie bazy danych...");

  // Hasło dla wszystkich kont testowych: drift123
  const rawPassword = "drift123";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  console.log(`Wygenerowano hash hasła dla '${rawPassword}'`);

  const testUsers = [
    {
      name: "Jan Kowalski",
      email: "owner@driftpark.pl",
      password: hashedPassword,
      role: "owner" as const,
      position: "Właściciel",
      isDemo: false
    },
    {
      name: "Marek Nowak",
      email: "manager@driftpark.pl",
      password: hashedPassword,
      role: "manager" as const,
      position: "Menedżer Toru",
      isDemo: false
    },
    {
      name: "Adam Wiśniewski",
      email: "pracownik@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Instruktor Driftu",
      isDemo: false
    },
    {
      name: "Katarzyna Zając",
      email: "kasia@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Obsługa Klienta",
      isDemo: false
    },
    {
      name: "Tomasz Wójcik",
      email: "tomek@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Instruktor Pro",
      isDemo: false
    }
  ];

  try {
    for (const u of testUsers) {
      console.log(`Przetwarzanie użytkownika: ${u.name} (${u.email})...`);
      
      // Sprawdzenie czy użytkownik o tym mailu już istnieje
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);

      if (existing.length > 0) {
        // Aktualizacja hasła i roli, aby upewnić się, że konto działa
        await db
          .update(users)
          .set({
            name: u.name,
            password: u.password,
            role: u.role,
            position: u.position,
            isDemo: u.isDemo
          })
          .where(eq(users.email, u.email));
        console.log(`Zaktualizowano istniejącego użytkownika: ${u.email}`);
      } else {
        // Wstawienie nowego użytkownika
        await db.insert(users).values(u);
        console.log(`Dodano nowego użytkownika: ${u.email}`);
      }
    }

    console.log("\nSeedowanie zakończone sukcesem!");
    console.log("Możesz teraz zalogować się na następujące konta:");
    console.log("--------------------------------------------------");
    console.log("1. Właściciel:  owner@driftpark.pl     hasło: drift123");
    console.log("2. Menedżer:    manager@driftpark.pl   hasło: drift123");
    console.log("3. Pracownik:   pracownik@driftpark.pl hasło: drift123");
    console.log("4. Pracownik:   kasia@driftpark.pl     hasło: drift123");
    console.log("5. Pracownik:   tomek@driftpark.pl     hasło: drift123");
    console.log("--------------------------------------------------");

  } catch (error) {
    console.error("Wystąpił błąd podczas seedowania bazy danych:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
