'use server';

import { db } from "@/db";
import { availability, settings } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { availabilitySaveSchema, parseOrError } from "@/lib/validation";

export interface AvailabilityEntry {
  id?: number;
  userId: number;
  date: string;
  status: 'available' | 'unavailable';
  statusManager: 'pending' | 'accepted' | 'rejected';
  remarks?: string | null;
}

async function getAvailabilityLockDay(): Promise<number> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'cron_availability_lock_day'))
      .limit(1);
    const day = Number(rows[0]?.value ?? 15);
    if (!Number.isFinite(day) || day < 1 || day > 28) return 15;
    return day;
  } catch {
    return 15;
  }
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
  const lockDay = await getAvailabilityLockDay();
  
  const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
  
  if (monthsDiff <= 0) {
    return true;
  }
  
  if (monthsDiff === 1) {
    return currentDay > lockDay;
  }
  
  return false;
}

export async function getAvailability(userId: number, year: number, month: number) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, data: [], error: "Brak autoryzacji." };
  }

  const sessionUserId = Number((session.user as any).id);
  const role = (session.user as any).role;
  const canViewOthers =
    role === 'owner' ||
    role === 'manager' ||
    hasPermission(session.user, 'schedule:edit');

  if (!canViewOthers && userId !== sessionUserId) {
    return { success: false, data: [], error: "Brak uprawnień do podglądu dyspozycyjności innego pracownika." };
  }

  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  
  try {
    const userIsDemo = (session.user as any)?.isDemo === true;

    const results = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.userId, userId),
          gte(availability.date, startDate),
          lte(availability.date, endDate),
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

  const parsed = parseOrError(availabilitySaveSchema, { userId, dateStr, status, remarks });
  if (!parsed.success) return { success: false, error: parsed.error };
  
  const userRole = (session.user as any).role;
  const loggedUserId = Number((session.user as any).id);
  if (parsed.data.userId !== loggedUserId && userRole !== 'owner' && userRole !== 'manager' && !hasPermission(session.user, 'schedule:edit')) {
    return { success: false, error: "Brak uprawnień do edycji dyspozycyjności innych pracowników." };
  }
  
  const { userId: targetUserId, dateStr: targetDate, status: targetStatus, remarks: targetRemarks } = parsed.data;

  const isLocked = await checkIsLocked(targetDate, userRole);
  if (isLocked) {
    const lockDay = await getAvailabilityLockDay();
    return { success: false, error: `Edycja dyspozycyjności na ten okres została zablokowana (minął ${lockDay}. dzień miesiąca).` };
  }
  
  try {
    const existing = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.userId, targetUserId),
          eq(availability.date, targetDate),
          eq(availability.isDemo, (session.user as any).isDemo === true)
        )
      )
      .limit(1);
      
    if (existing.length > 0) {
      await db
        .update(availability)
        .set({ status: targetStatus, remarks: targetRemarks, statusManager: 'pending', updatedAt: new Date() })
        .where(eq(availability.id, existing[0].id));
    } else {
      await db.insert(availability).values({
        userId: targetUserId,
        date: targetDate,
        status: targetStatus,
        remarks: targetRemarks,
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
        .where(and(
          eq(availability.id, id),
          eq(availability.isDemo, (session.user as any).isDemo === true)
        ));
    } else {
      const existing = await db
        .select()
        .from(availability)
        .where(and(
          eq(availability.userId, targetUserId),
          eq(availability.date, dateStr),
          eq(availability.isDemo, (session.user as any).isDemo === true)
        ))
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
