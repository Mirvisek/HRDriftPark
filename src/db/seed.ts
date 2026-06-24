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

import bcrypt from "bcryptjs";

async function main() {
  // Dynamiczny import bazy i schematów dopiero PO załadowaniu zmiennych env
  const { db } = await import("./index");
  const { users, settings } = await import("./schema");
  const { eq } = await import("drizzle-orm");

  console.log("Rozpoczynam seedowanie bazy danych...");

  // Hasło dla wszystkich kont testowych: drift123
  const rawPassword = "drift123";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  console.log(`Wygenerowano hash hasła dla '${rawPassword}'`);

  const testUsers = [
    {
      firstName: "Jan",
      lastName: "Kowalski",
      displayName: "Jan Kowalski",
      email: "owner@driftpark.pl",
      password: hashedPassword,
      role: "owner" as const,
      position: "Właściciel",
      birthDate: "1980-05-15",
      mustChangePassword: false,
      isDemo: false
    },
    {
      firstName: "Marek",
      lastName: "Nowak",
      displayName: "Marek Nowak",
      email: "manager@driftpark.pl",
      password: hashedPassword,
      role: "manager" as const,
      position: "Menedżer Toru",
      birthDate: "1985-08-20",
      mustChangePassword: false,
      isDemo: false
    },
    {
      firstName: "Adam",
      lastName: "Wiśniewski",
      displayName: "Adam Wiśniewski",
      email: "pracownik@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Instruktor Driftu",
      birthDate: "1995-03-10",
      mustChangePassword: false,
      isDemo: false
    },
    {
      firstName: "Katarzyna",
      lastName: "Zając",
      displayName: "Kasia Zając",
      email: "kasia@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Obsługa Klienta",
      birthDate: "1998-11-25",
      mustChangePassword: false,
      isDemo: false
    },
    {
      firstName: "Tomasz",
      lastName: "Wójcik",
      displayName: "Tomek Wójcik",
      email: "tomek@driftpark.pl",
      password: hashedPassword,
      role: "employee" as const,
      position: "Instruktor Pro",
      birthDate: "1992-07-05",
      mustChangePassword: false,
      isDemo: false
    },
    {
      firstName: "Piotr",
      lastName: "Zieliński",
      displayName: "Piotr Technik",
      email: "technik@driftpark.pl",
      password: hashedPassword,
      role: "technik" as const,
      position: "Technik Toru",
      birthDate: "1990-01-01",
      mustChangePassword: false,
      isDemo: false
    }
  ];

  const defaultSettings = [
    { key: "smtp_host", value: "smtp.mailtrap.io" },
    { key: "smtp_port", value: "2525" },
    { key: "smtp_secure", value: "false" },
    { key: "smtp_user", value: "placeholder_user" },
    { key: "smtp_password", value: "placeholder_password" },
    { key: "smtp_from", value: "Drift Park Extreme <no-reply@driftparkextreme.pl>" }
  ];

  try {
    // 1. Seedowanie użytkowników
    for (const u of testUsers) {
      console.log(`Przetwarzanie użytkownika: ${u.displayName} (${u.email})...`);
      
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(users)
          .set({
            firstName: u.firstName,
            lastName: u.lastName,
            displayName: u.displayName,
            password: u.password,
            role: u.role,
            position: u.position,
            birthDate: u.birthDate,
            mustChangePassword: u.mustChangePassword,
            isDemo: u.isDemo
          })
          .where(eq(users.email, u.email));
        console.log(`Zaktualizowano istniejącego użytkownika: ${u.email}`);
      } else {
        await db.insert(users).values(u);
        console.log(`Dodano nowego użytkownika: ${u.email}`);
      }
    }

    // 2. Seedowanie ustawień systemowych
    console.log("\nPrzetwarzanie domyślnych ustawień systemowych...");
    for (const s of defaultSettings) {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, s.key))
        .limit(1);

      if (existing.length > 0) {
        // Nie nadpisujemy istniejących konfiguracji SMTP, aby nie popsuć wpisanych wartości
        console.log(`Ustawienie '${s.key}' już istnieje. Pomijam.`);
      } else {
        await db.insert(settings).values(s);
        console.log(`Dodano domyślne ustawienie '${s.key}': ${s.value}`);
      }
    }

    console.log("\nSeedowanie zakończone sukcesem!");
    console.log("Możesz teraz zalogować się na następujące konta:");
    console.log("--------------------------------------------------");
    console.log("1. Właściciel:  owner@driftpark.pl     hasło: drift123");
    console.log("2. Menedżer:    manager@driftpark.pl   hasło: drift123");
    console.log("3. Technik:     technik@driftpark.pl   hasło: drift123");
    console.log("4. Pracownik:   pracownik@driftpark.pl hasło: drift123");
    console.log("5. Pracownik:   kasia@driftpark.pl     hasło: drift123");
    console.log("6. Pracownik:   tomek@driftpark.pl     hasło: drift123");
    console.log("--------------------------------------------------");

  } catch (error) {
    console.error("Wystąpił błąd podczas seedowania bazy danych:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
