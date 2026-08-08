import fs from 'fs';
import path from 'path';

// 1. Ręczne załadowanie zmiennych środowiskowych z pliku .env
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
}

import { sql } from 'drizzle-orm';

async function main() {
  const { db } = await import("./index");
  const { users, salaryHistory } = await import("./schema");

  console.log("Rozpoczynam BEZPIECZNĄ migrację struktury bazy danych...");

  // 1. Dodanie kolumny version do work_schedule (jeśli nie istnieje)
  try {
    console.log("Dodawanie kolumny 'version' do tabeli 'work_schedule'...");
    await db.execute(sql.raw("ALTER TABLE `work_schedule` ADD COLUMN `version` INT NOT NULL DEFAULT 1;"));
    console.log("[✓] Pomyślnie dodano kolumnę 'version' do 'work_schedule'.");
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("[i] Kolumna 'version' w 'work_schedule' już istnieje.");
    } else {
      console.error("Błąd podczas dodawania kolumny 'version' do 'work_schedule':", e.message);
    }
  }

  // 2. Dodanie kolumny version do timesheets (jeśli nie istnieje)
  try {
    console.log("Dodawanie kolumny 'version' do tabeli 'timesheets'...");
    await db.execute(sql.raw("ALTER TABLE `timesheets` ADD COLUMN `version` INT NOT NULL DEFAULT 1;"));
    console.log("[✓] Pomyślnie dodano kolumnę 'version' do 'timesheets'.");
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("[i] Kolumna 'version' w 'timesheets' już istnieje.");
    } else {
      console.error("Błąd podczas dodawania kolumny 'version' do 'timesheets':", e.message);
    }
  }

  // 3. Tworzenie tabeli audit_logs
  try {
    console.log("Tworzenie tabeli 'audit_logs'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NULL,
        \`entity_type\` VARCHAR(255) NOT NULL,
        \`entity_id\` INT NOT NULL,
        \`action\` VARCHAR(50) NOT NULL,
        \`old_value\` TEXT NULL,
        \`new_value\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'audit_logs' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'audit_logs':", e.message);
  }

  // 4. Tworzenie tabeli salary_history
  try {
    console.log("Tworzenie tabeli 'salary_history'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`salary_history\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`hourly_rate\` INT NOT NULL,
        \`valid_from\` DATE NOT NULL,
        \`valid_to\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'salary_history' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'salary_history':", e.message);
  }

  // 5. Inicjalizacja stawek początkowych dla istniejących użytkowników
  try {
    console.log("Generowanie stawek początkowych w salary_history dla obecnych użytkowników...");
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      // Sprawdź czy użytkownik ma już jakikolwiek wpis w historii
      const existingHistory = await db
        .select()
        .from(salaryHistory)
        .where(sql`user_id = ${u.id}`)
        .limit(1);

      if (existingHistory.length === 0) {
        console.log(`-> Tworzenie wpisu historycznego dla: ${u.displayName} (Stawka: ${u.hourlyRate || 0} PLN/h)`);
        await db.insert(salaryHistory).values({
          userId: u.id,
          hourlyRate: u.hourlyRate || 0,
          validFrom: '2026-01-01',
          validTo: null
        });
      }
    }
    console.log("[✓] Zakończono inicjalizację stawek historycznych.");
  } catch (e: any) {
    console.error("Błąd podczas generowania stawek początkowych:", e.message);
  }

  console.log("Bezpieczna migracja bazy danych zakończona pomyślnie!");
  process.exit(0);
}

main();
