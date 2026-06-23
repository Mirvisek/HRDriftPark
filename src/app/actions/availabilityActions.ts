'use server';

import { db } from "@/db";
import { availability, users } from "@/db/schema";
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
  
  const targetDate = new Date(targetDateStr);
  const now = new Date();
  
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  
  // Blokada przeszłych miesięcy
  if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
    return true;
  }
  
  // Blokada bieżącego miesiąca po 15. dniu
  if (targetYear === currentYear && targetMonth === currentMonth) {
    return currentDay > 15;
  }
  
  // Blokada przyszłego miesiąca (np. pracownik planuje na kolejny miesiąc, edycja otwarta do 15. dnia poprzedniego)
  // Czyli na miesiąc M możemy edytować do 15-go dnia miesiąca M-1.
  // Przykład: na lipiec (M) możemy edytować do 15 czerwca (M-1).
  const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
  if (monthsDiff === 1) {
    return currentDay > 15;
  } else if (monthsDiff > 1) {
    // Odległa przyszłość - pozwalamy edytować
    return false;
  }
  
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
    // Zwracamy pustą listę w przypadku błędu bazy, UI obsłuży to lokalnie (localStorage)
    return { success: false, data: [], error: "Brak połączenia z bazą danych." };
  }
}

export async function saveAvailability(userId: number, dateStr: string, status: 'available' | 'unavailable', remarks: string = '') {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Brak autoryzacji." };
  }
  
  const userRole = (session.user as any).role;
  const isDemo = (session.user as any).isDemo;
  
  // Sprawdzenie blokady
  const isLocked = await checkIsLocked(dateStr, userRole);
  if (isLocked) {
    return { success: false, error: "Edycja dyspozycyjności na ten okres została zablokowana (minął 15. dzień miesiąca)." };
  }
  
  if (isDemo) {
    // W trybie demo mockujemy udany zapis
    return { success: true, mocked: true, message: "Zapisano w trybie demo (lokalnie)." };
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
    return { success: false, dbDown: true, error: "Błąd bazy danych. Zmiana zostanie zapisana tylko w pamięci przeglądarki." };
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
  
  const isDemo = (session.user as any).isDemo;
  if (isDemo) {
    return { success: true, mocked: true };
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
