import { mysqlTable, int, varchar, text, boolean, timestamp, date, mysqlEnum, double, uniqueIndex, index } from 'drizzle-orm/mysql-core';

export const venues = mysqlTable('venues', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  colorAccent: varchar('color_accent', { length: 50 }).notNull().default('#ffd700'),
  openingHoursConfig: text('opening_hours_config'), // JSON string: { "1": { "open": "15:00", "close": "20:00", "closed": false }, ... }
  createdAt: timestamp('created_at').defaultNow(),
});

export const userGroups = mysqlTable('user_groups', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  roleKey: varchar('role_key', { length: 100 }).notNull().unique(),
  permissions: text('permissions').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

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
  groupId: int('group_id'),
  isDemo: boolean('is_demo').notNull().default(false),
  venueId: int('venue_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSessions = mysqlTable('user_sessions', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 50 }),
  expiresAt: timestamp('expires_at').notNull(),
  isValid: boolean('is_valid').notNull().default(true),
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
  status: mysqlEnum('status', ['draft', 'published', 'locked']).notNull().default('draft'),
  isDemo: boolean('is_demo').notNull().default(false),
  venueId: int('venue_id'),
  version: int('version').notNull().default(1), // Optymistyczne blokowanie
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  dateVenueIdx: index('work_schedule_date_venue_idx').on(table.date, table.venueId),
}));

export const timesheets = mysqlTable('timesheets', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  date: date('date', { mode: 'string' }).notNull(), // Format YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  remarks: text('remarks'),
  status: mysqlEnum('status', ['draft', 'submitted', 'approved', 'locked']).notNull().default('draft'),
  isLocked: boolean('is_locked').notNull().default(false),
  effectiveAt: date('effective_at', { mode: 'string' }),
  correctedAt: timestamp('corrected_at'),
  originalId: int('original_id'),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  createdById: int('created_by_id'),
  isDemo: boolean('is_demo').notNull().default(false),
  version: int('version').notNull().default(1), // Optymistyczne blokowanie
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userDateIdx: index('timesheets_user_date_idx').on(table.userId, table.date),
  dateIdx: index('timesheets_date_idx').on(table.date),
}));

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
  venueId: int('venue_id'),
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
  venueId: int('venue_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const shiftChecklists = mysqlTable('shift_checklists', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(),
  type: mysqlEnum('type', ['opening', 'closing']).notNull(),
  venueId: int('venue_id').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const shiftChecklistItems = mysqlTable('shift_checklist_items', {
  id: int('id').primaryKey().autoincrement(),
  checklistId: int('checklist_id').notNull(),
  itemKey: varchar('item_key', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  section: varchar('section', { length: 100 }).notNull(),
  sortOrder: int('sort_order').notNull(),
  dueMinutesBeforeClose: int('due_minutes_before_close'),
  status: mysqlEnum('status', ['pending', 'completed', 'not_applicable', 'problem']).notNull().default('pending'),
  note: text('note'),
  completedBy: int('completed_by'),
  completedByName: varchar('completed_by_name', { length: 255 }),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const shiftChecklistTemplates = mysqlTable('shift_checklist_templates', {
  id: int('id').primaryKey().autoincrement(),
  type: mysqlEnum('type', ['opening', 'closing']).notNull(),
  itemKey: varchar('item_key', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  section: varchar('section', { length: 100 }).notNull(),
  sortOrder: int('sort_order').notNull(),
  dueMinutesBeforeClose: int('due_minutes_before_close'),
  venueId: int('venue_id').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const shiftCashReconciliations = mysqlTable('shift_cash_reconciliations', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(),
  venueId: int('venue_id').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  openingCash: double('opening_cash').notNull().default(0),
  closingCash: double('closing_cash').notNull().default(0),
  fiscalReport: double('fiscal_report').notNull().default(0),
  terminalReport: double('terminal_report').notNull().default(0),
  blikReport: double('blik_report').notNull().default(0),
  cashToBag: double('cash_to_bag').notNull().default(0),
  eventCash: double('event_cash').notNull().default(0),
  cashOperations: double('cash_operations').notNull().default(0),
  checkAmount: double('check_amount').notNull().default(0),
  operationsDescription: text('operations_description'),
  differenceDescription: text('difference_description'),
  status: mysqlEnum('status', ['draft', 'submitted', 'approved', 'locked']).notNull().default('draft'),
  effectiveAt: date('effective_at', { mode: 'string' }),
  correctedAt: timestamp('corrected_at'),
  originalId: int('original_id'),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  completedBy: int('completed_by').notNull(),
  completedByName: varchar('completed_by_name', { length: 255 }).notNull(),
  completedAt: timestamp('completed_at').defaultNow().onUpdateNow(),
});

export const shiftReports = mysqlTable('shift_reports', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(),
  venueId: int('venue_id').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  intensity: mysqlEnum('intensity', ['calm', 'standard', 'busy']).notNull().default('standard'),
  incidents: text('incidents'),
  equipmentNotes: text('equipment_notes'),
  stockNotes: text('stock_notes'),
  handoverNotes: text('handover_notes'),
  completedBy: int('completed_by').notNull(),
  completedByName: varchar('completed_by_name', { length: 255 }).notNull(),
  completedAt: timestamp('completed_at').defaultNow().onUpdateNow(),
});

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id'), // Kto dokonał zmiany
  entityType: varchar('entity_type', { length: 255 }).notNull(), // np. 'timesheet', 'work_schedule'
  entityId: int('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // UPDATE, DELETE, TRANSITION
  oldValue: text('old_value'), // JSON
  newValue: text('new_value'), // JSON
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
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
  isDemo: boolean('is_demo').notNull().default(false),
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
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const warehouseBatches = mysqlTable('warehouse_batches', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: date('expiry_date', { mode: 'string' }),
  quantity: double('quantity').notNull().default(0),
  venueId: int('venue_id'),
  isDemo: boolean('is_demo').notNull().default(false),
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
  attachmentUrl: text('attachment_url'),
  venueId: int('venue_id'),
  status: mysqlEnum('status', ['draft', 'posted', 'locked']).notNull().default('posted'),
  effectiveAt: timestamp('effective_at').defaultNow(),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  productCreatedIdx: index('warehouse_history_product_created_idx').on(table.productId, table.createdAt),
}));

export const warehouseInventories = mysqlTable('warehouse_inventories', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  categoryId: int('category_id'), // NULL = cały magazyn
  type: mysqlEnum('type', ['full', 'spot']).notNull().default('full'),
  status: mysqlEnum('status', ['draft', 'submitted', 'approved', 'locked']).notNull().default('draft'),
  venueId: int('venue_id'),
  isDemo: boolean('is_demo').notNull().default(false),
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

// ==========================================
// NOWE TABELE FUNDAMENTU ENTERPRISE
// ==========================================

export const idempotencyKeys = mysqlTable('idempotency_keys', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  operation: varchar('operation', { length: 100 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']).notNull().default('pending'),
  result: text('result'), // JSON result of action execution
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  unqOpKey: uniqueIndex('unq_op_key').on(table.operation, table.idempotencyKey),
}));

export const outboxEvents = mysqlTable('outbox_events', {
  id: int('id').primaryKey().autoincrement(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: text('payload').notNull(), // JSON string
  status: mysqlEnum('status', ['pending', 'processing', 'delivered', 'failed']).notNull().default('pending'),
  retryCount: int('retry_count').notNull().default(0),
  errorDetails: text('error_details'),
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  statusIdx: index('outbox_events_status_idx').on(table.status),
}));

export const operationalDayClosing = mysqlTable('operational_day_closing', {
  id: int('id').primaryKey().autoincrement(),
  date: date('date', { mode: 'string' }).notNull(),
  venueId: int('venue_id').notNull(),
  status: mysqlEnum('status', ['closed', 'closed_with_exceptions']).notNull().default('closed'),
  snapshot: text('snapshot').notNull(), // JSON string summary metrics
  closedBy: int('closed_by').notNull(),
  closedByName: varchar('closed_by_name', { length: 255 }).notNull(),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const configurationVersions = mysqlTable('configuration_versions', {
  id: int('id').primaryKey().autoincrement(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  configValue: text('config_value').notNull(), // JSON string
  version: int('version').notNull().default(1),
  validFrom: timestamp('valid_from').defaultNow(),
  validTo: timestamp('valid_to'),
  updatedBy: int('updated_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const alerts = mysqlTable('alerts', {
  id: int('id').primaryKey().autoincrement(),
  ruleCode: varchar('rule_code', { length: 100 }).notNull(),
  severity: mysqlEnum('severity', ['info', 'low', 'medium', 'high', 'critical']).notNull().default('medium'),
  confidence: double('confidence').notNull().default(1.0),
  source: varchar('source', { length: 100 }).notNull().default('anomaly_engine'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: mysqlEnum('status', ['open', 'acknowledged', 'resolved', 'dismissed']).notNull().default('open'),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: int('entity_id'),
  venueId: int('venue_id'),
  employeeId: int('employee_id'),
  shiftId: int('shift_id'),
  acknowledgedBy: int('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedBy: int('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stockMovements = mysqlTable('stock_movements', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').notNull(),
  batchId: int('batch_id'),
  venueId: int('venue_id').notNull(),
  userId: int('user_id').notNull(),
  type: mysqlEnum('type', ['inbound_pz', 'outbound_wz', 'correction', 'transfer_out', 'transfer_in', 'inventory_adj']).notNull(),
  quantity: double('quantity').notNull(),
  sourceDocumentId: varchar('source_document_id', { length: 100 }),
  sourceDocumentType: varchar('source_document_type', { length: 100 }),
  effectiveAt: timestamp('effective_at').defaultNow(),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stockTransfers = mysqlTable('stock_transfers', {
  id: int('id').primaryKey().autoincrement(),
  transferNumber: varchar('transfer_number', { length: 100 }).notNull().unique(),
  sourceVenueId: int('source_venue_id').notNull(),
  targetVenueId: int('target_venue_id').notNull(),
  productId: int('product_id').notNull(),
  batchId: int('batch_id'),
  sentQuantity: double('sent_quantity').notNull(),
  receivedQuantity: double('received_quantity'),
  discrepancyQuantity: double('discrepancy_quantity').notNull().default(0),
  status: mysqlEnum('status', ['created', 'dispatched', 'received', 'partially_received', 'cancelled']).notNull().default('created'),
  sentBy: int('sent_by').notNull(),
  sentAt: timestamp('sent_at'),
  receivedBy: int('received_by'),
  receivedAt: timestamp('received_at'),
  reasonCode: varchar('reason_code', { length: 100 }),
  reasonText: text('reason_text'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const events = mysqlTable('events', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }),
  date: date('date', { mode: 'string' }).notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  participantsCount: int('participants_count').notNull().default(1),
  venueId: int('venue_id').notNull(),
  status: mysqlEnum('status', ['booked', 'confirmed', 'in_progress', 'completed', 'cancelled']).notNull().default('booked'),
  totalAmount: double('total_amount').notNull().default(0),
  depositPaid: double('deposit_paid').notNull().default(0),
  notes: text('notes'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
