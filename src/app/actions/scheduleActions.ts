'use server';

import { db } from "@/db";
import { workSchedule, availability, users, settings } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";
import { sendSystemNotification } from "./userActions";
import { sendPushNotification, getFormattedNotification } from "@/lib/webPush";

export interface ScheduleEntry {
  id?: number;
  date: string;
  leadUserId: number | null;
  supportUserId: number | null;
  remarks: string | null;
  leadName?: string;
  supportName?: string;
  eventRemarks?: string | null;
  eventUserIds?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed?: boolean;
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
        eventRemarks: workSchedule.eventRemarks,
        eventUserIds: workSchedule.eventUserIds,
        openTime: workSchedule.openTime,
        closeTime: workSchedule.closeTime,
        isClosed: workSchedule.isClosed,
      })
      .from(workSchedule)
      .where(like(workSchedule.date, pattern));

    // Dołączmy nazwy użytkowników
    const allUsers = await db.select({ id: users.id, name: users.displayName }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    const data: ScheduleEntry[] = results.map(r => ({
      ...r,
      leadName: r.leadUserId ? userMap.get(r.leadUserId) : undefined,
      supportName: r.supportUserId ? userMap.get(r.supportUserId) : undefined,
      isClosed: r.isClosed || false,
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
  remarks: string | null,
  eventRemarks: string | null = null,
  eventUserIds: string | null = null,
  openTime: string | null = null,
  closeTime: string | null = null,
  isClosed: boolean = false
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
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
        .set({ 
          leadUserId, 
          supportUserId, 
          remarks, 
          eventRemarks,
          eventUserIds,
          openTime,
          closeTime,
          isClosed,
          updatedAt: new Date() 
        })
        .where(eq(workSchedule.id, existing[0].id));
    } else {
      await db.insert(workSchedule).values({
        date: dateStr,
        leadUserId,
        supportUserId,
        remarks,
        eventRemarks,
        eventUserIds,
        openTime,
        closeTime,
        isClosed,
        isDemo: false
      });
    }

    // Sprawdź czy grafik na ten miesiąc jest już opublikowany. Jeśli nie, nie wysyłamy żadnych powiadomień.
    const [yStr, mStr] = dateStr.split('-');
    const pubKey = `schedule_published_${yStr}_${mStr}`;
    const pubSetting = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, pubKey))
      .limit(1);
    
    const isPublished = pubSetting.length > 0 && pubSetting[0].value === 'true';

    if (isPublished) {
      // Wyślij powiadomienia do przypisanych pracowników (Prowadzący i Wspomagający)
      if (leadUserId) {
        const msg = await getFormattedNotification(
          'template_assignment_lead', 
          { date: dateStr }, 
          `Zostałeś przypisany jako Osoba Prowadząca w dniu ${dateStr}.`
        );
        await sendSystemNotification(leadUserId, msg);
        await sendPushNotification(leadUserId, `Nowy dyżur: Prowadzący`, msg, `/schedule`);
      }
      if (supportUserId) {
        const msg = await getFormattedNotification(
          'template_assignment_support', 
          { date: dateStr }, 
          `Zostałeś przypisany jako Osoba Wspomagająca w dniu ${dateStr}.`
        );
        await sendSystemNotification(supportUserId, msg);
        await sendPushNotification(supportUserId, `Nowy dyżur: Wspomagający`, msg, `/schedule`);
      }

      // Powiadomienia dla osób przypisanych bezpośrednio do wydarzenia
      if (eventUserIds && eventRemarks) {
        const ids = eventUserIds.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
        for (const id of ids) {
          const msg = await getFormattedNotification(
            'template_assignment_event', 
            { date: dateStr, remarks: eventRemarks }, 
            `Zostałeś przypisany do obsługi wydarzenia: ${eventRemarks} w dniu ${dateStr}.`
          );
          await sendSystemNotification(id, msg);
          await sendPushNotification(id, `Przypisanie do wydarzenia`, msg, `/schedule`);
        }
      }

      // Jeśli zmieniono godziny otwarcia lub zamknięto lokal, powiadom główną obsadę
      if (isClosed || openTime || closeTime) {
        const statusText = isClosed ? "ZAMKNIĘTY" : `otwarty w godzinach ${openTime || '15:00'} - ${closeTime || '20:00'}`;
        const msg = await getFormattedNotification(
          'template_hours_change',
          { date: dateStr, status: statusText },
          `Zmiana godzin pracy w dniu ${dateStr}: Lokal jest ${statusText}.`
        );
        
        const recipients = new Set<number>();
        if (leadUserId) recipients.add(leadUserId);
        if (supportUserId) recipients.add(supportUserId);
        if (eventUserIds) {
          eventUserIds.split(',').map(Number).filter(id => !isNaN(id) && id > 0).forEach(id => recipients.add(id));
        }

        for (const id of recipients) {
          await sendSystemNotification(id, msg);
          await sendPushNotification(id, `Aktualizacja godzin pracy`, msg, `/schedule`);
        }
      }
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

    // Sprawdź czy grafik na ten miesiąc został już wygenerowany w całości (np. ma więcej niż 10 dni obsady)
    const existingSchedule = await db
      .select()
      .from(workSchedule)
      .where(like(workSchedule.date, pattern))
      .limit(11);

    if (existingSchedule.length > 10) {
      return { success: false, error: "Grafik na ten miesiąc został już wygenerowany. Wprowadzaj ewentualne poprawki bezpośrednio w tabeli." };
    }

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
    const allUsers = await db.select({ id: users.id, name: users.displayName }).from(users);
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

      // Powiadomienia (tylko systemowe, a te zostaną ograniczone w UI lub wyciszone)
      if (leadUserId) await sendSystemNotification(leadUserId, `Automatyczny grafik: Zostałeś przypisany jako Osoba Prowadząca na dzień ${dateStr}.`);
      if (supportUserId) await sendSystemNotification(supportUserId, `Automatyczny grafik: Zostałeś przypisany jako Osoba Wspomagająca na dzień ${dateStr}.`);
    }

    return { success: true, data: generatedEntries };
  } catch (e) {
    console.error("Błąd generowania grafiku:", e);
    return { success: false, error: "Błąd bazy danych podczas generowania grafiku." };
  }
}

export async function checkSchedulePublishedAction(year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const key = `schedule_published_${year}_${monthStr}`;

  try {
    const results = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (results.length > 0 && results[0].value === 'true') {
      return { success: true, published: true };
    }
    return { success: true, published: false };
  } catch (e) {
    console.error("Błąd sprawdzania statusu publikacji grafiku:", e);
    return { success: false, published: false };
  }
}

export async function publishScheduleAction(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager' && role !== 'technik') {
    return { success: false, error: "Brak uprawnień." };
  }

  const monthNames = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
  ];
  const monthStr = String(month).padStart(2, '0');
  const key = `schedule_published_${year}_${monthStr}`;

  try {
    // 1. Zapisz w bazie, że grafik został opublikowany
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({ value: 'true' })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({
        key,
        value: 'true',
      });
    }

    // 2. Pobierz treść szablonu i sformatuj
    const monthNamePL = `${monthNames[month]} ${year}`;
    const message = await getFormattedNotification(
      'template_schedule_published',
      { month: monthNamePL },
      `Grafik Pracy na ${monthNamePL} został opublikowany! Wejdź w system i sprawdź go!`
    );

    // 3. Wyślij powiadomienie push do wszystkich aktywnych użytkowników
    const allUsers = await db
      .select({ id: users.id })
      .from(users);

    for (const user of allUsers) {
      await sendSystemNotification(user.id, message);
      await sendPushNotification(user.id, "Grafik opublikowany 📅", message, "/schedule");
    }

    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas publikacji grafiku:", e);
    return { success: false, error: "Błąd bazy danych podczas publikacji grafiku." };
  }
}
