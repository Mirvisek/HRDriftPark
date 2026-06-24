'use server';

import { db } from "@/db";
import { timesheets, users } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";

export interface TimesheetEntry {
  id?: number;
  userId: number;
  date: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  remarks: string | null;
  isLocked: boolean;
  userName?: string;
  position?: string;
}

// Sprawdzenie czy edycja jest zablokowana (ostatni dzień miesiąca o 22:00)
export async function checkTimesheetLocked(year: number, month: number, userRole: string) {
  if (userRole === 'owner' || userRole === 'manager') {
    return false;
  }

  const now = new Date();
  
  // Ostatni dzień miesiąca
  const lastDay = new Date(year, month, 0); // month jest 1-indexed, więc 0 daje ostatni dzień poprzedniego miesiąca.
  lastDay.setHours(22, 0, 0, 0);

  return now.getTime() > lastDay.getTime();
}

export async function getTimesheets(userId: number, year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  try {
    const results = await db
      .select()
      .from(timesheets)
      .where(
        and(
          eq(timesheets.userId, userId),
          like(timesheets.date, pattern)
        )
      );
    return { success: true, data: results as TimesheetEntry[] };
  } catch (e) {
    console.error("Błąd pobierania kart godzin:", e);
    return { success: false, data: [], error: "Błąd bazy danych podczas pobierania kart godzin." };
  }
}

export async function saveTimesheet(
  id: number | undefined,
  userId: number,
  dateStr: string,
  startTime: string,
  endTime: string,
  remarks: string | null
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };

  const userRole = (session.user as any).role;

  // Bezpieczne parsowanie YYYY-MM-DD niezależne od strefy czasowej
  const [targetYear, targetMonth] = dateStr.split('-').map(Number);

  // Sprawdzanie blokady
  const isLocked = await checkTimesheetLocked(targetYear, targetMonth, userRole);
  if (isLocked) {
    return { success: false, error: "Edycja karty godzin na ten miesiąc została zablokowana (minęła godzina 22:00 ostatniego dnia miesiąca)." };
  }

  try {
    if (id) {
      // Aktualizacja
      await db
        .update(timesheets)
        .set({ startTime, endTime, remarks, isLocked: false })
        .where(eq(timesheets.id, id));
    } else {
      // Wstawianie
      await db.insert(timesheets).values({
        userId,
        date: dateStr,
        startTime,
        endTime,
        remarks,
        isLocked: false,
        isDemo: false
      });
    }
    return { success: true };
  } catch (e) {
    console.error("Błąd zapisu karty godzin:", e);
    return { success: false, error: "Błąd zapisu w bazie danych." };
  }
}

export async function deleteTimesheet(id: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };

  const userRole = (session.user as any).role;

  try {
    const existing = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1);
    if (existing.length === 0) return { success: false, error: "Nie znaleziono wpisu." };

    // Bezpieczne parsowanie YYYY-MM-DD niezależne od strefy czasowej
    const [targetYear, targetMonth] = existing[0].date.split('-').map(Number);

    const isLocked = await checkTimesheetLocked(targetYear, targetMonth, userRole);
    if (isLocked) {
      return { success: false, error: "Edycja zablokowana." };
    }

    await db.delete(timesheets).where(eq(timesheets.id, id));
    return { success: true };
  } catch (e) {
    console.error("Błąd usuwania wpisu:", e);
    return { success: false, error: "Błąd serwera podczas usuwania wpisu." };
  }
}

// Metoda dla Menedżera - pobierz wszystkie karty godzin
export async function getAllTimesheets(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, data: [], error: "Brak uprawnień." };
  }

  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  try {
    const results = await db
      .select({
        id: timesheets.id,
        userId: timesheets.userId,
        date: timesheets.date,
        startTime: timesheets.startTime,
        endTime: timesheets.endTime,
        remarks: timesheets.remarks,
        isLocked: timesheets.isLocked,
        userName: users.displayName,
        position: users.position
      })
      .from(timesheets)
      .innerJoin(users, eq(timesheets.userId, users.id))
      .where(like(timesheets.date, pattern));

    return { success: true, data: results as TimesheetEntry[] };
  } catch (e) {
    console.error("Błąd pobierania zbiorczych kart godzin:", e);
    return { success: false, data: [], error: "Błąd bazy danych podczas pobierania zbiorczych kart godzin." };
  }
}
