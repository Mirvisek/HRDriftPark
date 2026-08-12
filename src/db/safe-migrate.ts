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

function isDuplicateColumnError(e: any): boolean {
  const code = e.code || e.originalError?.code;
  const msg = String(e.message || '');
  return code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column name') || msg.includes('duplicate column');
}

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
    if (isDuplicateColumnError(e)) {
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
    if (isDuplicateColumnError(e)) {
      console.log("[i] Kolumna 'version' w 'timesheets' już istnieje.");
    } else {
      console.error("Błąd podczas dodawania kolumny 'version' do 'timesheets':", e.message);
    }
  }

  // 2.5. Dodanie kolumny permissions do users (jeśli nie istnieje)
  try {
    console.log("Dodawanie kolumny 'permissions' do tabeli 'users'...");
    await db.execute(sql.raw("ALTER TABLE `users` ADD COLUMN `permissions` TEXT NOT NULL DEFAULT '';"));
    console.log("[✓] Pomyślnie dodano kolumnę 'permissions' do 'users'.");
  } catch (e: any) {
    if (isDuplicateColumnError(e)) {
      console.log("[i] Kolumna 'permissions' w 'users' już istnieje.");
    } else {
      console.error("Błąd podczas dodawania kolumny 'permissions' do 'users':", e.message);
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
        \`hourly_rate\` DOUBLE NOT NULL,
        \`valid_from\` DATE NOT NULL,
        \`valid_to\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'salary_history' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'salary_history':", e.message);
  }

  // 4.5. Konwersja kolumn stawek na typ DOUBLE (aby wspierać ułamki np. 31.40)
  try {
    console.log("Konwertowanie kolumny 'hourly_rate' w tabeli 'users' na DOUBLE...");
    await db.execute(sql.raw("ALTER TABLE `users` MODIFY COLUMN `hourly_rate` DOUBLE NOT NULL DEFAULT 0;"));
    console.log("[✓] Konwersja 'users.hourly_rate' zakończona.");
  } catch (e: any) {
    console.error("Błąd konwersji 'users.hourly_rate':", e.message);
  }

  try {
    console.log("Konwertowanie kolumny 'hourly_rate' w tabeli 'salary_history' na DOUBLE...");
    await db.execute(sql.raw("ALTER TABLE `salary_history` MODIFY COLUMN `hourly_rate` DOUBLE NOT NULL;"));
    console.log("[✓] Konwersja 'salary_history.hourly_rate' zakończona.");
  } catch (e: any) {
    console.error("Błąd konwersji 'salary_history.hourly_rate':", e.message);
  }

  // 4.6. Tworzenie tabel magazynowych
  try {
    console.log("Tworzenie tabeli 'warehouse_categories'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_categories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_categories' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_categories':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'warehouse_products'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`category_id\` INT NOT NULL,
        \`supplier\` VARCHAR(255) NULL,
        \`unit\` VARCHAR(50) NOT NULL DEFAULT 'szt.',
        \`min_stock\` DOUBLE NOT NULL DEFAULT 0,
        \`max_stock\` DOUBLE NOT NULL DEFAULT 0,
        \`sku\` VARCHAR(100) NULL,
        \`location\` VARCHAR(255) NULL,
        \`has_expiry\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`auto_spot_check\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_products' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_products':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'warehouse_batches'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_batches\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` INT NOT NULL,
        \`batch_number\` VARCHAR(100) NULL,
        \`expiry_date\` DATE NULL,
        \`quantity\` DOUBLE NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_batches' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_batches':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'warehouse_history'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_history\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` INT NOT NULL,
        \`batch_id\` INT NULL,
        \`user_id\` INT NOT NULL,
        \`type\` VARCHAR(50) NOT NULL,
        \`quantity\` DOUBLE NOT NULL,
        \`source\` VARCHAR(255) NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_history' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_history':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'warehouse_inventories'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_inventories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`category_id\` INT NULL,
        \`type\` VARCHAR(50) NOT NULL DEFAULT 'full',
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'draft',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_inventories' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_inventories':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'warehouse_inventory_items'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`warehouse_inventory_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`inventory_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`system_stock\` DOUBLE NOT NULL,
        \`actual_stock\` DOUBLE NULL,
        \`difference\` DOUBLE NULL,
        \`remarks\` TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'warehouse_inventory_items' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'warehouse_inventory_items':", e.message);
  }

  // 4.7. Tworzenie tabeli venues
  try {
    console.log("Tworzenie tabeli 'venues'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`venues\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'venues' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'venues':", e.message);
  }

  // 4.8. Checklisty otwarcia i zamknięcia zmiany
  try {
    console.log("Tworzenie tabeli 'shift_checklists'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`shift_checklists\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`date\` DATE NOT NULL,
        \`type\` ENUM('opening', 'closing') NOT NULL,
        \`venue_id\` INT NOT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`shift_checklists_daily_unique\` (\`date\`, \`type\`, \`venue_id\`, \`is_demo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'shift_checklists' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'shift_checklists':", e.message);
  }

  try {
    console.log("Tworzenie tabeli 'shift_checklist_items'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`shift_checklist_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`checklist_id\` INT NOT NULL,
        \`item_key\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(500) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`sort_order\` INT NOT NULL,
        \`due_minutes_before_close\` INT NULL,
        \`status\` ENUM('pending', 'completed', 'not_applicable', 'problem') NOT NULL DEFAULT 'pending',
        \`note\` TEXT NULL,
        \`completed_by\` INT NULL,
        \`completed_by_name\` VARCHAR(255) NULL,
        \`completed_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`shift_checklist_item_unique\` (\`checklist_id\`, \`item_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'shift_checklist_items' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'shift_checklist_items':", e.message);
  }

  try {
    console.log("Dodawanie kolumn 'color_accent' i 'opening_hours_config' do tabeli 'venues'...");
    await db.execute(sql.raw("ALTER TABLE `venues` ADD COLUMN `color_accent` VARCHAR(50) NOT NULL DEFAULT '#ffd700';"));
    await db.execute(sql.raw("ALTER TABLE `venues` ADD COLUMN `opening_hours_config` TEXT NULL;"));
    console.log("[✓] Kolumny w 'venues' gotowe.");
  } catch (e: any) {
    if (isDuplicateColumnError(e)) {
      console.log("[i] Kolumny w 'venues' już istnieją.");
    } else {
      console.error("Błąd podczas dodawania kolumn do 'venues':", e.message);
    }
  }

  try {
    console.log("Tworzenie tabeli 'shift_checklist_templates'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`shift_checklist_templates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY, \`type\` ENUM('opening', 'closing') NOT NULL,
        \`item_key\` VARCHAR(100) NOT NULL, \`title\` VARCHAR(500) NOT NULL, \`section\` VARCHAR(100) NOT NULL,
        \`sort_order\` INT NOT NULL, \`due_minutes_before_close\` INT NULL, \`venue_id\` INT NOT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0, \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`shift_checklist_template_unique\` (\`type\`, \`item_key\`, \`venue_id\`, \`is_demo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'shift_checklist_templates' gotowa.");
  } catch (e: any) { console.error("Błąd podczas tworzenia tabeli 'shift_checklist_templates':", e.message); }

  try {
    console.log("Tworzenie tabeli 'shift_cash_reconciliations'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`shift_cash_reconciliations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY, \`date\` DATE NOT NULL, \`venue_id\` INT NOT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0, \`opening_cash\` DOUBLE NOT NULL DEFAULT 0,
        \`closing_cash\` DOUBLE NOT NULL DEFAULT 0, \`fiscal_report\` DOUBLE NOT NULL DEFAULT 0,
        \`terminal_report\` DOUBLE NOT NULL DEFAULT 0, \`blik_report\` DOUBLE NOT NULL DEFAULT 0,
        \`cash_to_bag\` DOUBLE NOT NULL DEFAULT 0, \`event_cash\` DOUBLE NOT NULL DEFAULT 0,
        \`cash_operations\` DOUBLE NOT NULL DEFAULT 0, \`check_amount\` DOUBLE NOT NULL DEFAULT 0,
        \`operations_description\` TEXT NULL, \`difference_description\` TEXT NULL,
        \`completed_by\` INT NOT NULL, \`completed_by_name\` VARCHAR(255) NOT NULL,
        \`completed_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`shift_cash_reconciliations_daily_unique\` (\`date\`, \`venue_id\`, \`is_demo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'shift_cash_reconciliations' gotowa.");
  } catch (e: any) { console.error("Błąd podczas tworzenia tabeli 'shift_cash_reconciliations':", e.message); }

  try {
    console.log("Tworzenie tabeli 'shift_reports'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`shift_reports\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY, \`date\` DATE NOT NULL, \`venue_id\` INT NOT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0, \`intensity\` ENUM('calm', 'standard', 'busy') NOT NULL DEFAULT 'standard',
        \`incidents\` TEXT NULL, \`equipment_notes\` TEXT NULL, \`stock_notes\` TEXT NULL, \`handover_notes\` TEXT NULL,
        \`completed_by\` INT NOT NULL, \`completed_by_name\` VARCHAR(255) NOT NULL,
        \`completed_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`shift_reports_daily_unique\` (\`date\`, \`venue_id\`, \`is_demo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'shift_reports' gotowa.");
  } catch (e: any) { console.error("Błąd podczas tworzenia tabeli 'shift_reports':", e.message); }

  // Wstawienie domyślnego lokalu, jeśli tabela venues jest pusta
  try {
    const existingVenues = await db.execute(sql.raw("SELECT COUNT(*) as count FROM `venues`;"));
    const count = (existingVenues as any)[0]?.[0]?.count || (existingVenues as any)[0]?.count || 0;
    if (Number(count) === 0) {
      console.log("Wstawianie domyślnego lokalu 'Kraków Rynek'...");
      await db.execute(sql.raw("INSERT INTO `venues` (id, name) VALUES (1, 'Kraków Rynek');"));
      console.log("[✓] Wstawiono domyślny lokal.");
    }
  } catch (e: any) {
    console.error("Błąd podczas sprawdzania/wstawiania domyślnego lokalu:", e.message);
  }

  // Dodanie kolumny venue_id do powiązanych tabel
  const tablesToAlterVenue = [
    'users',
    'work_schedule',
    'shift_tasks',
    'task_templates',
    'warehouse_batches',
    'warehouse_history',
    'warehouse_inventories'
  ];

  for (const tbl of tablesToAlterVenue) {
    try {
      console.log(`Dodawanie kolumny 'venue_id' do tabeli '${tbl}'...`);
      await db.execute(sql.raw(`ALTER TABLE \`${tbl}\` ADD COLUMN \`venue_id\` INT NULL;`));
      console.log(`[✓] Pomyślnie dodano kolumnę 'venue_id' do '${tbl}'.`);
    } catch (e: any) {
      if (isDuplicateColumnError(e)) {
        console.log(`[i] Kolumna 'venue_id' w '${tbl}' już istnieje.`);
      } else {
        console.error(`Błąd podczas dodawania kolumny 'venue_id' do '${tbl}':`, e.message);
      }
    }

    try {
      await db.execute(sql.raw(`UPDATE \`${tbl}\` SET \`venue_id\` = 1 WHERE \`venue_id\` IS NULL;`));
    } catch (e: any) {
      console.error(`Błąd podczas ustawiania domyślnego 'venue_id' dla '${tbl}':`, e.message);
    }
  }

  // Dodanie kolumny attachment_url do warehouse_history
  try {
    console.log("Dodawanie kolumny 'attachment_url' do tabeli 'warehouse_history'...");
    await db.execute(sql.raw("ALTER TABLE `warehouse_history` ADD COLUMN `attachment_url` TEXT NULL;"));
    console.log("[✓] Pomyślnie dodano kolumnę 'attachment_url' do 'warehouse_history'.");
  } catch (e: any) {
    if (isDuplicateColumnError(e)) {
      console.log("[i] Kolumna 'attachment_url' w 'warehouse_history' już istnieje.");
    } else {
      console.error("Błąd podczas dodawania kolumny 'attachment_url' do 'warehouse_history':", e.message);
    }
  }

  // Dodanie kolumny is_demo do tabel magazynowych (izolacja trybu demo)
  const warehouseTablesForDemo = [
    'warehouse_categories',
    'warehouse_products',
    'warehouse_batches',
    'warehouse_history',
    'warehouse_inventories'
  ];
  for (const tbl of warehouseTablesForDemo) {
    try {
      console.log(`Dodawanie kolumny 'is_demo' do tabeli '${tbl}'...`);
      await db.execute(sql.raw(`ALTER TABLE \`${tbl}\` ADD COLUMN \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0;`));
      console.log(`[✓] Pomyślnie dodano kolumnę 'is_demo' do '${tbl}'.`);
    } catch (e: any) {
      if (isDuplicateColumnError(e)) {
        console.log(`[i] Kolumna 'is_demo' w '${tbl}' już istnieje.`);
      } else {
        console.error(`Błąd podczas dodawania kolumny 'is_demo' do '${tbl}':`, e.message);
      }
    }
  }

  // 5. Inicjalizacja stawek początkowych oraz uprawnień dla istniejących użytkowników
  try {
    console.log("Generowanie stawek początkowych w salary_history oraz domyślnych uprawnień dla obecnych użytkowników...");
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      // A. Sprawdź stawkę historyczną
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

      // B. Sprawdź i nadaj domyślne uprawnienia (jeśli kolumna jest pusta)
      if (!u.permissions) {
        let defaultPerms = "";
        if (u.role === 'owner') {
          defaultPerms = "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
        } else if (u.role === 'manager') {
          defaultPerms = "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory";
        } else if (u.role === 'technik') {
          defaultPerms = "schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
        } else if (u.role === 'employee') {
          defaultPerms = "schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory";
        }

        console.log(`-> Nadawanie domyślnych uprawnień dla ${u.displayName} (${u.role}): ${defaultPerms}`);
        await db.update(users).set({ permissions: defaultPerms }).where(sql`id = ${u.id}`);
      }
    }
    console.log("[✓] Zakończono inicjalizację stawek historycznych i uprawnień.");
  } catch (e: any) {
    console.error("Błąd podczas generowania stawek/uprawnień początkowych:", e.message);
  }

  console.log("Bezpieczna migracja bazy danych zakończona pomyślnie!");
  process.exit(0);
}

main();
