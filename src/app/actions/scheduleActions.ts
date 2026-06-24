'use server';

import { db } from "@/db";
import { workSchedule, availability, users } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";
import { sendSystemNotification } from "./userActions";

export interface ScheduleEntry {
  id?: number;
  date: string;
  leadUserId: number | null;
  supportUserId: number | null;
  remarks: string | null;
  leadName?: string;
  supportName?: string;
}

export async function getWorkSchedule(year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  try {
    const results = await db
      .select({
        id: workSchedule.id,
        date: workSchedule.date,
        leadUserId: workSchedule.leadUserId,
        supportUserId: workSchedule.supportUserId,
        remarks: workSchedule.remarks,
      })
      .from(workSchedule)
      .where(like(workSchedule.date, pattern));

    // Dołączmy nazwy użytkowników
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    const data: ScheduleEntry[] = results.map(r => ({
      ...r,
      leadName: r.leadUserId ? userMap.get(r.leadUserId) : undefined,
      supportName: r.supportUserId ? userMap.get(r.supportUserId) : undefined,
    }));

    return { success: true, data };
  } catch (e) {
    console.error("Błąd pobierania grafiku z bazy:", e);
    return { success: false, data: [], error: "Brak bazy danych." };
  }
}

export async function saveWorkScheduleEntry(
  dateStr: string,
  leadUserId: number | null,
  supportUserId: number | null,
  remarks: string | null
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, error: "Brak uprawnień do edycji grafiku." };
  }

  try {
    // Sprawdź czy wpis już istnieje
    const existing = await db
      .select()
      .from(workSchedule)
      .where(eq(workSchedule.date, dateStr))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(workSchedule)
        .set({ leadUserId, supportUserId, remarks, updatedAt: new Date() })
        .where(eq(workSchedule.id, existing[0].id));
    } else {
      await db.insert(workSchedule).values({
        date: dateStr,
        leadUserId,
        supportUserId,
        remarks,
        isDemo: false
      });
    }

    // Wyślij powiadomienia do przypisanych pracowników
    if (leadUserId) {
      await sendSystemNotification(leadUserId, `Zostałeś przypisany jako Osoba Prowadząca w dniu ${dateStr}.`);
    }
    if (supportUserId) {
      await sendSystemNotification(supportUserId, `Zostałeś przypisany jako Osoba Wspomagająca w dniu ${dateStr}.`);
    }

    return { success: true };
  } catch (e) {
    console.error("Błąd zapisu wpisu grafiku:", e);
    return { success: false, error: "Błąd bazy danych" };
  }
}

// Algorytm automatycznego generowania grafiku bazujący na dostępności
export async function generateSchedule(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, error: "Brak uprawnień." };
  }

  const monthStr = String(month).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();

  try {
    // Pobierz wszystkich dostępnych pracowników w wybranym miesiącu
    const pattern = `${year}-${monthStr}-%`;
    const availabilities = await db
      .select()
      .from(availability)
      .where(
        and(
          like(availability.date, pattern),
          eq(availability.status, 'available')
        )
      );

    // Pobierz wszystkich użytkowników
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    // Grupuj dostępność według dat
    const dateAvailMap: Record<string, number[]> = {};
    availabilities.forEach(av => {
      if (!dateAvailMap[av.date]) dateAvailMap[av.date] = [];
      dateAvailMap[av.date].push(av.userId);
    });

    const generatedEntries: ScheduleEntry[] = [];

    // Generujemy grafik na każdy dzień
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
      const availableUserIds = dateAvailMap[dateStr] || [];

      let leadUserId: number | null = null;
      let supportUserId: number | null = null;
      let remarks: string | null = null;

      if (availableUserIds.length >= 2) {
        leadUserId = availableUserIds[0];
        supportUserId = availableUserIds[1];
      } else if (availableUserIds.length === 1) {
        leadUserId = availableUserIds[0];
        remarks = "Brak osoby wspomagającej (tylko 1 osoba dostępna)";
      } else {
        remarks = "Brak dostępnych pracowników na ten dzień";
      }

      // Usuń istniejący wpis na ten dzień, jeśli jest
      const existing = await db
        .select()
        .from(workSchedule)
        .where(eq(workSchedule.date, dateStr))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(workSchedule)
          .set({ leadUserId, supportUserId, remarks, updatedAt: new Date() })
          .where(eq(workSchedule.id, existing[0].id));
      } else {
        await db.insert(workSchedule).values({
          date: dateStr,
          leadUserId,
          supportUserId,
          remarks,
          isDemo: false
        });
      }

      generatedEntries.push({
        date: dateStr,
        leadUserId,
        supportUserId,
        remarks,
        leadName: leadUserId ? userMap.get(leadUserId) : undefined,
        supportName: supportUserId ? userMap.get(supportUserId) : undefined,
      });

      // Powiadomienia
      if (leadUserId) await sendSystemNotification(leadUserId, `Automatyczny grafik: Zostałeś przypisany jako Osoba Prowadząca na dzień ${dateStr}.`);
      if (supportUserId) await sendSystemNotification(supportUserId, `Automatyczny grafik: Zostałeś przypisany jako Osoba Wspomagająca na dzień ${dateStr}.`);
    }

    return { success: true, data: generatedEntries };
  } catch (e) {
    console.error("Błąd generowania grafiku:", e);
    return { success: false, error: "Błąd bazy danych podczas generowania grafiku." };
  }
}
