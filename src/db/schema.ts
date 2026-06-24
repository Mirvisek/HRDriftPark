import { mysqlTable, int, varchar, text, boolean, timestamp, date, mysqlEnum } from 'drizzle-orm/mysql-core';

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
  isDemo: boolean('is_demo').notNull().default(false),
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

