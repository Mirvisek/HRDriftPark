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
  const code = e.code || e.originalError?.code || e.cause?.code;
  const msg = `${String(e.message || '')} ${String(e.cause?.message || '')} ${String(e.originalError?.message || '')}`;
  return code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column name') || msg.includes('duplicate column');
}

function isDuplicateIndexError(e: any): boolean {
  const code = e.code || e.originalError?.code || e.cause?.code;
  const msg = `${String(e.message || '')} ${String(e.cause?.message || '')} ${String(e.originalError?.message || '')}`;
  return code === 'ER_DUP_KEYNAME' || msg.includes('Duplicate key name') || msg.includes('duplicate key');
}

async function main() {
  const { db } = await import("./index");
  const { users, salaryHistory } = await import("./schema");

  console.log("Rozpoczynam BEZPIECZNĄ migrację struktury bazy danych...");

  // Helper do bezpiecznego dodawania kolumn
  const addColumnSafely = async (tableName: string, colDef: string) => {
    try {
      await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD COLUMN ${colDef};`));
      console.log(`[✓] Dodano kolumnę do '${tableName}': ${colDef.split(' ')[0]}`);
    } catch (e: any) {
      if (isDuplicateColumnError(e)) {
        // Ignoruj istniejące kolumny
      } else {
        console.error(`Błąd podczas dodawania kolumny do '${tableName}':`, e.cause?.message || e.originalError?.message || e.message);
      }
    }
  };

  // Helper do bezpiecznego dodawania indeksów
  const addIndexSafely = async (tableName: string, indexName: string, columns: string) => {
    try {
      await db.execute(sql.raw(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columns});`));
      console.log(`[✓] Dodano indeks '${indexName}' do '${tableName}'`);
    } catch (e: any) {
      if (isDuplicateIndexError(e)) {
        // Ignoruj istniejący indeks
      } else {
        console.error(`Błąd podczas dodawania indeksu '${indexName}' do '${tableName}':`, e.cause?.message || e.originalError?.message || e.message);
      }
    }
  };

  // 1. Wersjonowanie i statusy w tabelach bazowych
  await addColumnSafely('work_schedule', '`version` INT NOT NULL DEFAULT 1');
  await addColumnSafely('work_schedule', "`status` ENUM('draft', 'published', 'locked') NOT NULL DEFAULT 'draft'");
  await addColumnSafely('timesheets', '`version` INT NOT NULL DEFAULT 1');
  await addColumnSafely('timesheets', "`status` ENUM('draft', 'submitted', 'approved', 'locked') NOT NULL DEFAULT 'draft'");
  await addColumnSafely('timesheets', '`effective_at` DATE NULL');
  await addColumnSafely('timesheets', '`corrected_at` TIMESTAMP NULL');
  await addColumnSafely('timesheets', '`original_id` INT NULL');
  await addColumnSafely('timesheets', '`reason_code` VARCHAR(100) NULL');
  await addColumnSafely('timesheets', '`reason_text` TEXT NULL');
  await addColumnSafely('timesheets', '`created_by_id` INT NULL');

  await addColumnSafely('users', "`permissions` TEXT NOT NULL DEFAULT ''");

  // 2. Tworzenie tabeli audit_logs
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
        \`reason_code\` VARCHAR(100) NULL,
        \`reason_text\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'audit_logs' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli:", e.cause?.message || e.originalError?.message || e.message);
  }
  await addColumnSafely('audit_logs', '`reason_code` VARCHAR(100) NULL');
  await addColumnSafely('audit_logs', '`reason_text` TEXT NULL');

  // 3. Tworzenie tabeli salary_history
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

  // 4. Tworzenie tabeli user_sessions
  try {
    console.log("Tworzenie tabeli 'user_sessions'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`session_token\` VARCHAR(255) NOT NULL UNIQUE,
        \`user_agent\` TEXT NULL,
        \`ip_address\` VARCHAR(50) NULL,
        \`expires_at\` TIMESTAMP NOT NULL,
        \`is_valid\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'user_sessions' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'user_sessions':", e.message);
  }

  // 5. Tworzenie tabeli idempotency_keys
  try {
    console.log("Tworzenie tabeli 'idempotency_keys'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`idempotency_keys\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`operation\` VARCHAR(100) NOT NULL,
        \`idempotency_key\` VARCHAR(255) NOT NULL,
        \`status\` ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
        \`result\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unq_op_key\` (\`operation\`, \`idempotency_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'idempotency_keys' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'idempotency_keys':", e.message);
  }

  // 6. Tworzenie tabeli outbox_events
  try {
    console.log("Tworzenie tabeli 'outbox_events'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`outbox_events\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_type\` VARCHAR(100) NOT NULL,
        \`payload\` TEXT NOT NULL,
        \`status\` ENUM('pending', 'processing', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
        \`retry_count\` INT NOT NULL DEFAULT 0,
        \`error_details\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`processed_at\` TIMESTAMP NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'outbox_events' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'outbox_events':", e.message);
  }

  // 7. Tworzenie tabeli operational_day_closing
  try {
    console.log("Tworzenie tabeli 'operational_day_closing'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`operational_day_closing\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`date\` DATE NOT NULL,
        \`venue_id\` INT NOT NULL,
        \`status\` ENUM('closed', 'closed_with_exceptions') NOT NULL DEFAULT 'closed',
        \`snapshot\` TEXT NOT NULL,
        \`closed_by\` INT NOT NULL,
        \`closed_by_name\` VARCHAR(255) NOT NULL,
        \`reason_code\` VARCHAR(100) NULL,
        \`reason_text\` TEXT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'operational_day_closing' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'operational_day_closing':", e.message);
  }

  // 8. Tworzenie tabeli configuration_versions
  try {
    console.log("Tworzenie tabeli 'configuration_versions'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`configuration_versions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`config_key\` VARCHAR(100) NOT NULL,
        \`config_value\` TEXT NOT NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`valid_from\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`valid_to\` TIMESTAMP NULL,
        \`updated_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'configuration_versions' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'configuration_versions':", e.message);
  }

  // 9. Tworzenie tabeli alerts
  try {
    console.log("Tworzenie tabeli 'alerts'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`alerts\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`rule_code\` VARCHAR(100) NOT NULL,
        \`severity\` ENUM('info', 'low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
        \`confidence\` DOUBLE NOT NULL DEFAULT 1.0,
        \`source\` VARCHAR(100) NOT NULL DEFAULT 'anomaly_engine',
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`status\` ENUM('open', 'acknowledged', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
        \`entity_type\` VARCHAR(100) NULL,
        \`entity_id\` INT NULL,
        \`venue_id\` INT NULL,
        \`employee_id\` INT NULL,
        \`shift_id\` INT NULL,
        \`acknowledged_by\` INT NULL,
        \`acknowledged_at\` TIMESTAMP NULL,
        \`resolved_by\` INT NULL,
        \`resolved_at\` TIMESTAMP NULL,
        \`reason_code\` VARCHAR(100) NULL,
        \`reason_text\` TEXT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'alerts' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'alerts':", e.message);
  }

  // 10. Tworzenie tabeli stock_movements
  try {
    console.log("Tworzenie tabeli 'stock_movements'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`stock_movements\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` INT NOT NULL,
        \`batch_id\` INT NULL,
        \`venue_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`type\` ENUM('inbound_pz', 'outbound_wz', 'correction', 'transfer_out', 'transfer_in', 'inventory_adj') NOT NULL,
        \`quantity\` DOUBLE NOT NULL,
        \`source_document_id\` VARCHAR(100) NULL,
        \`source_document_type\` VARCHAR(100) NULL,
        \`effective_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`reason_code\` VARCHAR(100) NULL,
        \`reason_text\` TEXT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'stock_movements' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'stock_movements':", e.message);
  }

  // 11. Tworzenie tabeli stock_transfers
  try {
    console.log("Tworzenie tabeli 'stock_transfers'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`stock_transfers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`transfer_number\` VARCHAR(100) NOT NULL UNIQUE,
        \`source_venue_id\` INT NOT NULL,
        \`target_venue_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`batch_id\` INT NULL,
        \`sent_quantity\` DOUBLE NOT NULL,
        \`received_quantity\` DOUBLE NULL,
        \`discrepancy_quantity\` DOUBLE NOT NULL DEFAULT 0,
        \`status\` ENUM('created', 'dispatched', 'received', 'partially_received', 'cancelled') NOT NULL DEFAULT 'created',
        \`sent_by\` INT NOT NULL,
        \`sent_at\` TIMESTAMP NULL,
        \`received_by\` INT NULL,
        \`received_at\` TIMESTAMP NULL,
        \`reason_code\` VARCHAR(100) NULL,
        \`reason_text\` TEXT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'stock_transfers' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'stock_transfers':", e.message);
  }

  // 12. Tworzenie tabeli events
  try {
    console.log("Tworzenie tabeli 'events'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`events\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`customer_name\` VARCHAR(255) NOT NULL,
        \`customer_phone\` VARCHAR(50) NULL,
        \`date\` DATE NOT NULL,
        \`start_time\` VARCHAR(5) NOT NULL,
        \`end_time\` VARCHAR(5) NOT NULL,
        \`participants_count\` INT NOT NULL DEFAULT 1,
        \`venue_id\` INT NOT NULL,
        \`status\` ENUM('booked', 'confirmed', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'booked',
        \`total_amount\` DOUBLE NOT NULL DEFAULT 0,
        \`deposit_paid\` DOUBLE NOT NULL DEFAULT 0,
        \`notes\` TEXT NULL,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'events' gotowa.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'events':", e.message);
  }

  // 13. Aktualizacja shift_cash_reconciliations
  await addColumnSafely('shift_cash_reconciliations', "`status` ENUM('draft', 'submitted', 'approved', 'locked') NOT NULL DEFAULT 'draft'");
  await addColumnSafely('shift_cash_reconciliations', '`effective_at` DATE NULL');
  await addColumnSafely('shift_cash_reconciliations', '`corrected_at` TIMESTAMP NULL');
  await addColumnSafely('shift_cash_reconciliations', '`original_id` INT NULL');
  await addColumnSafely('shift_cash_reconciliations', '`reason_code` VARCHAR(100) NULL');
  await addColumnSafely('shift_cash_reconciliations', '`reason_text` TEXT NULL');

  // 14. Aktualizacja warehouse_history i warehouse_inventories
  await addColumnSafely('warehouse_history', "`status` ENUM('draft', 'posted', 'locked') NOT NULL DEFAULT 'posted'");
  await addColumnSafely('warehouse_history', '`effective_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnSafely('warehouse_history', '`reason_code` VARCHAR(100) NULL');
  await addColumnSafely('warehouse_history', '`reason_text` TEXT NULL');
  await addColumnSafely('warehouse_inventories', "`status` ENUM('draft', 'submitted', 'approved', 'locked') NOT NULL DEFAULT 'draft'");

  // 15. Tworzenie tabeli user_groups i dodanie group_id do users
  await addColumnSafely('users', '`group_id` INT NULL');
  try {
    console.log("Tworzenie tabeli 'user_groups'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`user_groups\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL UNIQUE,
        \`role_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`permissions\` TEXT NOT NULL,
        \`is_system\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'user_groups' gotowa.");

    // Seed domyślnych grup systemowych jeśli nie istnieją
    const defaultGroups = [
      {
        name: 'Właściciel',
        roleKey: 'owner',
        permissions: 'schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage',
        isSystem: 1
      },
      {
        name: 'Menedżer',
        roleKey: 'manager',
        permissions: 'schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory',
        isSystem: 1
      },
      {
        name: 'Technik',
        roleKey: 'technik',
        permissions: 'schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage',
        isSystem: 1
      },
      {
        name: 'Pracownik Toru',
        roleKey: 'employee',
        permissions: 'schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory',
        isSystem: 1
      }
    ];

    for (const g of defaultGroups) {
      await db.execute(sql.raw(`
        INSERT IGNORE INTO \`user_groups\` (\`name\`, \`role_key\`, \`permissions\`, \`is_system\`)
        VALUES ('${g.name}', '${g.roleKey}', '${g.permissions}', ${g.isSystem});
      `));
    }
    console.log("[✓] Domyślne grupy użytkowników zostały zainicjalizowane.");
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'user_groups':", e.cause?.message || e.message);
  }

  // 16. Indeksy wydajnościowe
  console.log("Dodawanie indeksów wydajnościowych...");
  await addIndexSafely('timesheets', 'timesheets_user_date_idx', '`user_id`, `date`');
  await addIndexSafely('timesheets', 'timesheets_date_idx', '`date`');
  await addIndexSafely('work_schedule', 'work_schedule_date_venue_idx', '`date`, `venue_id`');
  await addIndexSafely('warehouse_history', 'warehouse_history_product_created_idx', '`product_id`, `created_at`');
  await addIndexSafely('outbox_events', 'outbox_events_status_idx', '`status`');

  // 17. Tworzenie tabeli active_shifts
  try {
    console.log("Tworzenie tabeli 'active_shifts'...");
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`active_shifts\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`date\` DATE NOT NULL,
        \`start_time\` VARCHAR(5) NOT NULL,
        \`started_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`shift_role\` ENUM('lead', 'support', 'cleaning', 'replacement') NOT NULL DEFAULT 'lead',
        \`venue_id\` INT NOT NULL DEFAULT 1,
        \`is_demo\` TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `));
    console.log("[✓] Tabela 'active_shifts' gotowa.");
    await addIndexSafely('active_shifts', 'active_shifts_user_idx', '`user_id`');
    await addIndexSafely('active_shifts', 'active_shifts_date_venue_idx', '`date`, `venue_id`');
  } catch (e: any) {
    console.error("Błąd podczas tworzenia tabeli 'active_shifts':", e.message);
  }

  console.log("Bezpieczna migracja bazy danych zakończona pomyślnie!");
  process.exit(0);
}

main();
