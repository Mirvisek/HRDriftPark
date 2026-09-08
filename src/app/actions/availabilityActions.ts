'use server';

import { db } from "@/db";
import { availability } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export interface AvailabilityEntry {
  id?: number;
  userId: number;
  date: string;
  status: 'available' | 'unavailable';
  statusManager: 'pending' | 'accepted' | 'rejected';
  remarks?: string | null;
}

export async function checkIsLocked(targetDateStr: string, userRole: string) {
  if (userRole === 'owner' || userRole === 'manager') {
    return false;
  }
  
  const [targetYear, targetMonth] = targetDateStr.split('-').map(Number);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  
  const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
  
  if (monthsDiff <= 0) {
    return true;
  }
  
  if (monthsDiff === 1) {
    return currentDay > 15;
  }
  
  return false;
}

export async function getAvailability(userId: number, year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const yearMonthPattern = `${year}-${monthStr}-%`;
  
  try {
    const session = await auth();
    const userIsDemo = (session?.user as any)?.isDemo === true;

    const results = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.userId, userId),
          like(availability.date, yearMonthPattern),
          eq(availability.isDemo, userIsDemo)
        )
      );
    return { success: true, data: results as AvailabilityEntry[] };
  } catch (e) {
    console.error("Błąd pobierania dyspozycyjności z bazy:", e);
    return { success: false, data: [], error: "Brak połączenia z bazą danych." };
  }
}

export async function saveAvailability(userId: number, dateStr: string, status: 'available' | 'unavailable', remarks: string = '') {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Brak autoryzacji." };
  }
  
  const userRole = (session.user as any).role;
  const loggedUserId = Number((session.user as any).id);
  if (userId !== loggedUserId && userRole !== 'owner' && userRole !== 'manager' && !hasPermission(session.user, 'schedule:edit')) {
    return { success: false, error: "Brak uprawnień do edycji dyspozycyjności innych pracowników." };
  }
  
  const isLocked = await checkIsLocked(dateStr, userRole);
  if (isLocked) {
    return { success: false, error: "Edycja dyspozycyjności na ten okres została zablokowana (minął 15. dzień miesiąca)." };
  }
  
  try {
    const existing = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.userId, userId),
          eq(availability.date, dateStr)
        )
      )
      .limit(1);
      
    if (existing.length > 0) {
      await db
        .update(availability)
        .set({ status, remarks, statusManager: 'pending', updatedAt: new Date() })
        .where(eq(availability.id, existing[0].id));
    } else {
      await db.insert(availability).values({
        userId,
        date: dateStr,
        status,
        remarks,
        statusManager: 'pending',
        isDemo: (session.user as any).isDemo === true
      });
    }
    
    return { success: true };
  } catch (e) {
    console.error("Błąd zapisu dyspozycyjności w bazie:", e);
    return { success: false, error: "Błąd zapisu w bazie danych." };
  }
}

// Manager/Owner/Admin akceptuje lub odrzuca dyspozycyjność
export async function reviewAvailability(
  id: number | null | undefined,
  targetUserId: number,
  dateStr: string,
  statusManager: 'accepted' | 'rejected'
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };
  
  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && !hasPermission(session.user, 'schedule:edit')) {
    return { success: false, error: "Brak uprawnień menedżerskich do akceptacji dyspozycyjności." };
  }
  
  try {
    if (id) {
      await db
        .update(availability)
        .set({ statusManager, updatedAt: new Date() })
        .where(eq(availability.id, id));
    } else {
      const existing = await db
        .select()
        .from(availability)
        .where(and(eq(availability.userId, targetUserId), eq(availability.date, dateStr)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(availability)
          .set({ statusManager, updatedAt: new Date() })
          .where(eq(availability.id, existing[0].id));
      } else {
        await db.insert(availability).values({
          userId: targetUserId,
          date: dateStr,
          status: 'available',
          statusManager,
          isDemo: (session.user as any).isDemo === true
        });
      }
    }
    return { success: true };
  } catch (e) {
    console.error("Błąd aktualizacji statusu dyspozycyjności:", e);
    return { success: false, error: "Błąd bazy danych podczas akceptacji dyspozycyjności." };
  }
}
