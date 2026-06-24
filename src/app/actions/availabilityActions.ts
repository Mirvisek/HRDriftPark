'use server';

import { db } from "@/db";
import { availability } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";

export interface AvailabilityEntry {
  id?: number;
  userId: number;
  date: string;
  status: 'available' | 'unavailable';
  statusManager: 'pending' | 'accepted' | 'rejected';
  remarks?: string | null;
}

// Sprawdzenie czy edycja jest zablokowana (po 15. dniu miesiąca dla pracowników)
export async function checkIsLocked(targetDateStr: string, userRole: string) {
  if (userRole === 'owner' || userRole === 'manager') {
    return false;
  }
  
  // Bezpieczne parsowanie YYYY-MM-DD niezależne od strefy czasowej
  const [targetYear, targetMonth] = targetDateStr.split('-').map(Number);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();
  
  // Różnica w miesiącach
  const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
  
  // 1. Miesiące przeszłe oraz miesiąc bieżący są zawsze zablokowane do planowania dla pracowników
  if (monthsDiff <= 0) {
    return true;
  }
  
  // 2. Następny miesiąc (M+1) jest edytowalny tylko do 15-go dnia bieżącego miesiąca (M)
  if (monthsDiff === 1) {
    return currentDay > 15;
  }
  
  // 3. Dalsza przyszłość (M+2, M+3 itd.) jest zawsze otwarta do edycji
  return false;
}

export async function getAvailability(userId: number, year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const yearMonthPattern = `${year}-${monthStr}-%`;
  
  try {
    const results = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.userId, userId),
          like(availability.date, yearMonthPattern)
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
  
  // Sprawdzenie blokady
  const isLocked = await checkIsLocked(dateStr, userRole);
  if (isLocked) {
    return { success: false, error: "Edycja dyspozycyjności na ten okres została zablokowana (minął 15. dzień miesiąca)." };
  }
  
  try {
    // Sprawdź czy już istnieje wpis na ten dzień
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
        isDemo: false
      });
    }
    
    return { success: true };
  } catch (e) {
    console.error("Błąd zapisu dyspozycyjności w bazie:", e);
    return { success: false, error: "Błąd zapisu w bazie danych." };
  }
}

// Manager/Owner akceptuje lub odrzuca dyspozycyjność
export async function reviewAvailability(id: number, statusManager: 'accepted' | 'rejected') {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };
  
  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, error: "Brak uprawnień menedżerskich." };
  }
  
  try {
    await db
      .update(availability)
      .set({ statusManager })
      .where(eq(availability.id, id));
    return { success: true };
  } catch (e) {
    console.error("Błąd aktualizacji statusu dyspozycyjności:", e);
    return { success: false, error: "Błąd bazy danych." };
  }
}
