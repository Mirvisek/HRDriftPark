'use server';

import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { auth } from "@/auth";

export interface UserEntry {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'employee';
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
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,
        isDemo: users.isDemo,
      })
      .from(users);
      
    return { success: true, data: results };
  } catch (e) {
    console.error("Błąd pobierania pracowników:", e);
    // W przypadku błędu bazy (np. brak połączenia), zwracamy konta demo
    const mockEmployees = [
      { id: 1, name: "Adam Wiśniewski", email: "pracownik@driftpark.pl", role: "employee", position: "Instruktor Driftu", isDemo: true },
      { id: 2, name: "Marek Nowak", email: "manager@driftpark.pl", role: "manager", position: "Menedżer Toru", isDemo: true },
      { id: 3, name: "Jan Kowalski", email: "owner@driftpark.pl", role: "owner", position: "Właściciel", isDemo: true },
      { id: 4, name: "Katarzyna Zając", email: "kasia@driftpark.pl", role: "employee", position: "Obsługa Klienta", isDemo: true },
      { id: 5, name: "Tomasz Wójcik", email: "tomek@driftpark.pl", role: "employee", position: "Instruktor Pro", isDemo: true }
    ] as UserEntry[];
    return { success: true, data: mockEmployees, mocked: true };
  }
}

export async function sendSystemNotification(userId: number, message: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };
  
  const isDemo = (session.user as any).isDemo;
  if (isDemo) {
    console.log(`[DEMO MODE] Wysyłanie powiadomienia do użytkownika ${userId}: "${message}"`);
    return { success: true, mocked: true };
  }
  
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
    return { success: false, error: "Błąd bazy danych" };
  }
}

export async function getNotifications() {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };
  
  const userId = Number((session.user as any).id);
  if (isNaN(userId)) {
    // W trybie demo userId to string np. 'demo-owner-id', więc zwracamy mocki
    const mockNotifications = [
      { id: 1, userId: 1, message: "Twój grafik na lipiec został zaakceptowany przez managera.", isRead: false, createdAt: new Date() },
      { id: 2, userId: 1, message: "Manager zmienił Twój dyżur w dniu 15 lipca.", isRead: true, createdAt: new Date(Date.now() - 3600000) }
    ];
    return { success: true, data: mockNotifications };
  }
  
  try {
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.createdAt);
    return { success: true, data: results };
  } catch (e) {
    console.error("Błąd pobierania powiadomień:", e);
    return { success: false, data: [] };
  }
}
