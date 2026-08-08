import { mysqlTable, int, varchar, text, boolean, timestamp, date, mysqlEnum, double } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['owner', 'manager', 'employee', 'technik']).notNull().default('employee'),
  position: varchar('position', { length: 255 }).notNull().default('Pracownik toru'),
  birthDate: date('birth_date', { mode: 'string' }).notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  resetToken: varchar('reset_token', { length: 255 }),
  resetTokenExpires: timestamp('reset_token_expires'),
  hourlyRate: double('hourly_rate').notNull().default(0), // Stawka godzinowa w PLN (Double dla dziesiętnych)
  permissions: text('permissions').notNull().default(''), // Uprawnienia rozdzielane przecinkami
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const availability = mysqlTable('availability', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  date: date('date', { mode: 'string' }).notNull(), // Format YYYY-MM-DD
  status: mysqlEnum('status', ['available', 'unavailable']).notNull(),
  statusManager: mysqlEnum('status_manager', ['pending', 'accepted', 'rejected']).notNull().default('pending'),
  remarks: text('remarks'),
  isDemo: boolean('is_demo').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const workSchedule = mysqlTable('work_schedule', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(), // Format YYYY-MM-DD
  leadUserId: int('lead_user_id'), // Osoba Prowadząca
  supportUserId: int('support_user_id'), // Osoba Wspomagająca
  remarks: text('remarks'),
  eventRemarks: text('event_remarks'), // Opis wydarzenia (np. Urodziny)
  eventUserIds: varchar('event_user_ids', { length: 1000 }), // Rozdzielona przecinkami lista ID pracowników
  openTime: varchar('open_time', { length: 5 }), // Godzina otwarcia, np. "15:00"
  closeTime: varchar('close_time', { length: 5 }), // Godzina zamknięcia, np. "20:00"
  isClosed: boolean('is_closed').notNull().default(false), // Czy lokal zamknięty
  isDemo: boolean('is_demo').notNull().default(false),
  version: int('version').notNull().default(1), // Optymistyczne blokowanie
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const timesheets = mysqlTable('timesheets', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  date: date('date', { mode: 'string' }).notNull(), // Format YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  remarks: text('remarks'),
  isLocked: boolean('is_locked').notNull().default(false),
  isDemo: boolean('is_demo').notNull().default(false),
  version: int('version').notNull().default(1), // Optymistyczne blokowanie
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = mysqlTable('notifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const pushSubscriptions = mysqlTable('push_subscriptions', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const taskTemplates = mysqlTable('task_templates', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  dayOfWeek: int('day_of_week').notNull(), // 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const shiftTasks = mysqlTable('shift_tasks', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(), // Format YYYY-MM-DD
  title: varchar('title', { length: 255 }).notNull(),
  type: mysqlEnum('type', ['recurring', 'additional']).notNull().default('recurring'), // stałe poza ruchem / dodatkowe
  priority: mysqlEnum('priority', ['low', 'medium', 'high']).notNull().default('medium'),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedBy: int('completed_by'), // userId
  completedByName: varchar('completed_by_name', { length: 255 }),
  completedAt: timestamp('completed_at'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id'), // Kto dokonał zmiany
  entityType: varchar('entity_type', { length: 255 }).notNull(), // np. 'timesheet', 'work_schedule'
  entityId: int('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // UPDATE, DELETE
  oldValue: text('old_value'), // JSON
  newValue: text('new_value'), // JSON
  createdAt: timestamp('created_at').defaultNow(),
});

export const salaryHistory = mysqlTable('salary_history', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  hourlyRate: double('hourly_rate').notNull(),
  validFrom: date('valid_from', { mode: 'string' }).notNull(), // Data rozpoczęcia
  validTo: date('valid_to', { mode: 'string' }), // Data zakończenia (null oznacza wciąż aktywną)
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseCategories = mysqlTable('warehouse_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseProducts = mysqlTable('warehouse_products', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: int('category_id').notNull(),
  supplier: varchar('supplier', { length: 255 }),
  unit: varchar('unit', { length: 50 }).notNull().default('szt.'),
  minStock: double('min_stock').notNull().default(0),
  maxStock: double('max_stock').notNull().default(0),
  sku: varchar('sku', { length: 100 }),
  location: varchar('location', { length: 255 }),
  hasExpiry: boolean('has_expiry').notNull().default(false),
  autoSpotCheck: boolean('auto_spot_check').notNull().default(false),
  status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseBatches = mysqlTable('warehouse_batches', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: date('expiry_date', { mode: 'string' }),
  quantity: double('quantity').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseHistory = mysqlTable('warehouse_history', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').notNull(),
  batchId: int('batch_id'),
  userId: int('user_id').notNull(),
  type: mysqlEnum('type', ['delivery', 'issue', 'correction', 'inventory']).notNull(),
  quantity: double('quantity').notNull(),
  source: varchar('source', { length: 255 }), // dostawca, lokal docelowy, powód korekty
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseInventories = mysqlTable('warehouse_inventories', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  categoryId: int('category_id'), // NULL = cały magazyn
  type: mysqlEnum('type', ['full', 'spot']).notNull().default('full'),
  status: mysqlEnum('status', ['draft', 'submitted']).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseInventoryItems = mysqlTable('warehouse_inventory_items', {
  id: int('id').primaryKey().autoincrement(),
  inventoryId: int('inventory_id').notNull(),
  productId: int('product_id').notNull(),
  systemStock: double('system_stock').notNull(),
  actualStock: double('actual_stock'),
  difference: double('difference'),
  remarks: text('remarks'),
});

