'use server';

import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { insertNotification } from "@/lib/notify";

export interface UserEntry {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'employee' | 'technik';
  position: string;
  isDemo: boolean;
}

export async function getEmployees() {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };
  const userIsDemo = (session.user as any).isDemo === true;
  const includeRate = hasPermission(session.user, "payroll:view");
  
  try {
    const results = await db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        role: users.role,
        position: users.position,
        isDemo: users.isDemo,
      })
      .from(users)
      .where(eq(users.isDemo, userIsDemo));

    if (!includeRate) return { success: true, data: results };

    const rates = await db
      .select({ id: users.id, hourlyRate: users.hourlyRate })
      .from(users)
      .where(eq(users.isDemo, userIsDemo));
    const rateById = new Map(rates.map((row) => [row.id, row.hourlyRate]));
    return {
      success: true,
      data: results.map((row) => ({ ...row, hourlyRate: rateById.get(row.id) ?? 0 })),
    };
  } catch (e) {
    console.error("Błąd pobierania pracowników:", e);
    return { success: false, data: [], error: "Błąd bazy danych przy pobieraniu pracowników" };
  }
}

export async function sendSystemNotification(userId: number, message: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  const role = (session.user as any).role;
  const allowed = role === "owner" || role === "manager" || role === "technik"
    || hasPermission(session.user, "schedule:edit")
    || hasPermission(session.user, "push:send");
  if (!allowed) return { success: false, error: "Brak uprawnień do wysyłania powiadomień." };
  if (!userId || !message?.trim() || message.length > 500) {
    return { success: false, error: "Nieprawidłowa treść powiadomienia." };
  }
  const userIsDemo = (session.user as any).isDemo === true;
  
  try {
    await insertNotification(userId, message.trim(), userIsDemo);
    return { success: true };
  } catch (e) {
    console.error("Błąd zapisu powiadomienia:", e);
    return { success: false, error: "Błąd bazy danych przy zapisie powiadomienia" };
  }
}

export async function getNotifications() {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };
  
  const userId = Number((session.user as any).id);
  if (isNaN(userId)) {
    return { success: false, data: [], error: "Niepoprawne ID użytkownika" };
  }
  
  try {
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    return { success: true, data: results };
  } catch (e) {
    console.error("Błąd pobierania powiadomień:", e);
    return { success: false, data: [], error: "Błąd bazy danych przy pobieraniu powiadomień" };
  }
}

export async function markNotificationsAsReadAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  if (isNaN(userId)) return { success: false, error: "Niepoprawne ID użytkownika" };

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    return { success: true };
  } catch (e) {
    console.error("Błąd aktualizacji powiadomień:", e);
    return { success: false, error: "Błąd bazy danych podczas odznaczania powiadomień." };
  }
}

export async function getCurrentUserRateAction() {
  const session = await auth();
  if (!session?.user) return { success: false, rate: 0 };
  const userId = Number((session.user as any).id);
  if (!userId) return { success: false, rate: 0 };

  try {
    const results = await db
      .select({ hourlyRate: users.hourlyRate })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (results.length > 0) {
      return { success: true, rate: results[0].hourlyRate };
    }
    return { success: false, rate: 0 };
  } catch (e) {
    return { success: false, rate: 0 };
  }
}

