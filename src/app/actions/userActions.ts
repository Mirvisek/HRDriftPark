'use server';

import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq, ne, desc } from "drizzle-orm";
import { auth } from "@/auth";

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
  
  try {
    const results = await db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        role: users.role,
        position: users.position,
        isDemo: users.isDemo,
        hourlyRate: users.hourlyRate,
      })
      .from(users);
      
    return { success: true, data: results };
  } catch (e) {
    console.error("Błąd pobierania pracowników:", e);
    return { success: false, data: [], error: "Błąd bazy danych przy pobieraniu pracowników" };
  }
}

export async function sendSystemNotification(userId: number, message: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  
  try {
    await db.insert(notifications).values({
      userId,
      message,
      isRead: false,
      isDemo: false
    });
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
