'use server';

import { db } from "@/db";
import { workSchedule, availability, users, settings } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";
import { auth } from "@/auth";
import { sendSystemNotification, logAuditEvent } from "./userActions";
import { sendPushNotification, getFormattedNotification } from "@/lib/webPush";
import { hasPermission } from "@/lib/permissions";

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
  version?: number;
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
        version: workSchedule.version,
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

export async function checkRestPeriodViolation(
  userId: number,
  targetDateStr: string,
  targetOpenTime: string | null,
  targetCloseTime: string | null,
  targetIsClosed: boolean
) {
  if (targetIsClosed) return null;

  const getDefaultHours = (dStr: string) => {
    const d = new Date(dStr);
    const day = d.getDay();
    if (day === 1) return { isClosed: true, open: '15:00', close: '20:00' };
    if (day >= 2 && day <= 5) return { isClosed: false, open: '15:00', close: '20:00' };
    return { isClosed: false, open: '12:00', close: '20:00' };
  };

  const parsedTargetOpen = targetOpenTime || getDefaultHours(targetDateStr).open;
  const parsedTargetClose = targetCloseTime || getDefaultHours(targetDateStr).close;

  // 1. Dzień poprzedni (X - 1)
  const prevDate = new Date(targetDateStr);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const prevShift = await db
    .select()
    .from(workSchedule)
    .where(eq(workSchedule.date, prevDateStr))
    .limit(1);

  if (prevShift.length > 0 && !prevShift[0].isClosed) {
    const isLead = prevShift[0].leadUserId === userId;
    const isSupport = prevShift[0].supportUserId === userId;
    const isEvent = prevShift[0].eventUserIds && prevShift[0].eventUserIds.split(',').map(Number).includes(userId);

    if (isLead || isSupport || isEvent) {
      const prevClose = prevShift[0].closeTime || getDefaultHours(prevDateStr).close;
      
      const [cHour, cMin] = prevClose.split(':').map(Number);
      const [oHour, oMin] = parsedTargetOpen.split(':').map(Number);

      const restHours = (24 - (cHour + cMin / 60)) + (oHour + oMin / 60);
      if (restHours < 11) {
        return {
          type: 'prev',
          date: prevDateStr,
          closeTime: prevClose,
          openTime: parsedTargetOpen,
          restHours: Math.round(restHours * 10) / 10
        };
      }
    }
  }

  // 2. Dzień następny (X + 1)
  const nextDate = new Date(targetDateStr);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  const nextShift = await db
    .select()
    .from(workSchedule)
    .where(eq(workSchedule.date, nextDateStr))
    .limit(1);

  if (nextShift.length > 0 && !nextShift[0].isClosed) {
    const isLead = nextShift[0].leadUserId === userId;
    const isSupport = nextShift[0].supportUserId === userId;
    const isEvent = nextShift[0].eventUserIds && nextShift[0].eventUserIds.split(',').map(Number).includes(userId);

    if (isLead || isSupport || isEvent) {
      const nextOpen = nextShift[0].openTime || getDefaultHours(nextDateStr).open;
      
      const [cHour, cMin] = parsedTargetClose.split(':').map(Number);
      const [oHour, oMin] = nextOpen.split(':').map(Number);

      const restHours = (24 - (cHour + cMin / 60)) + (oHour + oMin / 60);
      if (restHours < 11) {
        return {
          type: 'next',
          date: nextDateStr,
          closeTime: parsedTargetClose,
          openTime: nextOpen,
          restHours: Math.round(restHours * 10) / 10
        };
      }
    }
  }

  return null;
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
  isClosed: boolean = false,
  clientVersion?: number
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  if (!hasPermission(session.user, 'schedule:edit')) {
    return { success: false, error: "Brak uprawnień do edycji grafiku." };
  }

  const executorId = session.user ? Number((session.user as any).id) : null;

  try {
    // Sprawdź czy wpis już istnieje
    const existing = await db
      .select()
      .from(workSchedule)
      .where(eq(workSchedule.date, dateStr))
      .limit(1);

    // Optymistyczne blokowanie i logowanie
    if (existing.length > 0) {
      if (clientVersion !== undefined && existing[0].version !== clientVersion) {
        return { success: false, error: "Konflikt edycji: Grafik został zmodyfikowany przez innego menedżera. Odśwież stronę." };
      }

      const nextVersion = existing[0].version + 1;
      
      await logAuditEvent(
        executorId, 
        'work_schedule', 
        existing[0].id, 
        'UPDATE', 
        existing[0], 
        { leadUserId, supportUserId, remarks, eventRemarks, eventUserIds, openTime, closeTime, isClosed, version: nextVersion }
      );

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
          version: nextVersion,
          updatedAt: new Date() 
        })
        .where(and(eq(workSchedule.id, existing[0].id), eq(workSchedule.version, existing[0].version)));
    } else {
      const [insertResult] = await db.insert(workSchedule).values({
        date: dateStr,
        leadUserId,
        supportUserId,
        remarks,
        eventRemarks,
        eventUserIds,
        openTime,
        closeTime,
        isClosed,
        isDemo: false,
        version: 1
      });

      const newId = (insertResult as any).insertId || 0;
      await logAuditEvent(
        executorId,
        'work_schedule',
        newId,
        'INSERT',
        null,
        { date: dateStr, leadUserId, supportUserId, remarks, eventRemarks, eventUserIds, openTime, closeTime, isClosed, version: 1 }
      );
    }

    // Sprawdzenie 11h odpoczynku dobowego (Generowanie Ostrzeżeń)
    const warnings: string[] = [];
    
    const checkUserViolation = async (uId: number, roleName: string) => {
      const violation = await checkRestPeriodViolation(uId, dateStr, openTime, closeTime, isClosed);
      if (violation) {
        const u = await db.select({ name: users.displayName }).from(users).where(eq(users.id, uId)).limit(1);
        const name = u.length > 0 ? u[0].name : `Użytkownik ID ${uId}`;
        if (violation.type === 'prev') {
          warnings.push(`Ostrzeżenie (Kodeks Pracy): ${name} (${roleName}) ma tylko ${violation.restHours}h odpoczynku między dyżurami (koniec ${violation.date} o ${violation.closeTime}, start ${dateStr} o ${violation.openTime}).`);
        } else {
          warnings.push(`Ostrzeżenie (Kodeks Pracy): ${name} (${roleName}) ma tylko ${violation.restHours}h odpoczynku między dyżurami (koniec ${dateStr} o ${violation.closeTime}, start ${violation.date} o ${violation.openTime}).`);
        }
      }
    };

    if (leadUserId) await checkUserViolation(leadUserId, 'Prowadzący');
    if (supportUserId) await checkUserViolation(supportUserId, 'Wspomagający');

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

    return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    console.error("Błąd zapisu wpisu grafiku:", e);
    return { success: false, error: "Błąd bazy danych" };
  }
}

// Algorytm automatycznego generowania grafiku bazujący na dostępności
export async function generateSchedule(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  if (!hasPermission(session.user, 'schedule:edit')) {
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

  if (!hasPermission(session.user, 'schedule:edit')) {
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

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (const user of allUsers) {
      await sendSystemNotification(user.id, message);
      await sendPushNotification(user.id, "Grafik opublikowany 📅", message, "/schedule");
      await delay(100);
    }

    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas publikacji grafiku:", e);
    return { success: false, error: "Błąd bazy danych podczas publikacji grafiku." };
  }
}
