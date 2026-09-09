'use server';

import { db } from "@/db";
import { activeShifts, timesheets, workSchedule, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { AnomalyEngine } from "@/services/anomalyEngine";
import { logAuditEvent } from "./userActions";

export type ShiftRole = 'lead' | 'support' | 'cleaning' | 'replacement';

export const SHIFT_ROLE_LABELS: Record<ShiftRole, string> = {
  lead: 'Osoba prowadząca',
  support: 'Osoba wspomagająca',
  cleaning: 'Prace porządkowe',
  replacement: 'Zamiana osoby prowadzącej',
};

export interface ActiveShiftInfo {
  hasActiveShift: boolean;
  shift?: {
    id: number;
    userId: number;
    date: string;
    startTime: string;
    startedAt: Date | null;
    shiftRole: ShiftRole;
    venueId: number;
  };
  suggestedRole?: ShiftRole;
}

function getPolandDateTime() {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeStr = timeFormatter.format(now);
  const parts = dateFormatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || String(now.getFullYear());
  const month = parts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0');
  const day = parts.find(p => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return { dateStr, timeStr, now };
}

/**
 * Pobiera informację o aktywnej zmianie zalogowanego pracownika oraz sugerowaną rolę z grafiku na dziś.
 */
export async function getActiveShiftAction(): Promise<ActiveShiftInfo> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { hasActiveShift: false };
    }

    const userId = Number((session.user as { id?: string }).id);
    const venueId = Number((session.user as { venueId?: number }).venueId || 1);
    const isDemo = (session.user as { isDemo?: boolean }).isDemo === true;

    const { dateStr } = getPolandDateTime();

    // 1. Sprawdź czy pracownik ma już aktywną zmianę
    const activeList = await db
      .select()
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    // 2. Pobierz grafik na dziś pod kątem sugerowanej roli
    const scheduleList = await db
      .select()
      .from(workSchedule)
      .where(and(eq(workSchedule.date, dateStr), eq(workSchedule.venueId, venueId), eq(workSchedule.isDemo, isDemo)))
      .limit(1);

    let suggestedRole: ShiftRole = 'lead';
    if (scheduleList.length > 0) {
      const todaySched = scheduleList[0];
      if (todaySched.leadUserId === userId) {
        suggestedRole = 'lead';
      } else if (todaySched.supportUserId === userId) {
        suggestedRole = 'support';
      }
    }

    if (activeList.length > 0) {
      const row = activeList[0];
      return {
        hasActiveShift: true,
        shift: {
          id: row.id,
          userId: row.userId,
          date: row.date,
          startTime: row.startTime,
          startedAt: row.startedAt,
          shiftRole: row.shiftRole as ShiftRole,
          venueId: row.venueId,
        },
        suggestedRole,
      };
    }

    return {
      hasActiveShift: false,
      suggestedRole,
    };
  } catch (error) {
    console.error('[ShiftService] getActiveShiftAction error:', error);
    return { hasActiveShift: false };
  }
}

/**
 * Rozpoczyna usługę pracy (Punch-In) z wybraną rolą.
 */
export async function startShiftAction(shiftRole: ShiftRole): Promise<{ success: boolean; error?: string; startTime?: string; roleLabel?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Brak autoryzacji.' };
    }

    const validRoles: ShiftRole[] = ['lead', 'support', 'cleaning', 'replacement'];
    if (!validRoles.includes(shiftRole)) {
      return { success: false, error: 'Nieprawidłowa rola na zmianie.' };
    }

    const userId = Number((session.user as { id?: string }).id);
    const venueId = Number((session.user as { venueId?: number }).venueId || 1);
    const isDemo = (session.user as { isDemo?: boolean }).isDemo === true;

    // Sprawdź czy już nie jest w pracy
    const existing = await db
      .select({ id: activeShifts.id })
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Twoja usługa pracy jest już aktywna!' };
    }

    const { dateStr, timeStr, now } = getPolandDateTime();

    await db.insert(activeShifts).values({
      userId,
      date: dateStr,
      startTime: timeStr,
      startedAt: now,
      shiftRole,
      venueId,
      isDemo,
    });

    console.log(`[ShiftService] Pracownik #${userId} rozpoczął pracę (${shiftRole}) o ${timeStr}`);
    return {
      success: true,
      startTime: timeStr,
      roleLabel: SHIFT_ROLE_LABELS[shiftRole],
    };
  } catch (error) {
    console.error('[ShiftService] startShiftAction error:', error);
    return { success: false, error: 'Błąd serwera podczas uruchamiania usługi pracy.' };
  }
}

/**
 * Kończy usługę pracy (Punch-Out), wylicza czas i zapisuje do timesheets.
 */
export async function stopShiftAction(): Promise<{ success: boolean; error?: string; timesheetId?: number; duration?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Brak autoryzacji.' };
    }

    const userId = Number((session.user as { id?: string }).id);
    const isDemo = (session.user as { isDemo?: boolean }).isDemo === true;

    const activeList = await db
      .select()
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    if (activeList.length === 0) {
      return { success: false, error: 'Brak aktywnej zmiany do zakończenia.' };
    }

    const active = activeList[0];
    const { timeStr } = getPolandDateTime();
    const roleKey = active.shiftRole as ShiftRole;
    const roleLabel = SHIFT_ROLE_LABELS[roleKey] || 'Pracownik toru';
    const remarks = `Rola na zmianie: ${roleLabel}`;

    // Wstaw wpis do timesheets
    const [inserted] = await db.insert(timesheets).values({
      userId,
      date: active.date,
      startTime: active.startTime,
      endTime: timeStr,
      remarks,
      status: 'submitted',
      isLocked: false,
      reasonCode: roleKey,
      reasonText: roleLabel,
      createdById: userId,
      isDemo,
      version: 1,
    });

    const newTimesheetId = (inserted as { insertId?: number }).insertId || 0;

    // Usuń z tabeli aktywnych zmian
    await db.delete(activeShifts).where(eq(activeShifts.id, active.id));

    // Log audytowy
    await logAuditEvent(userId, 'timesheet', newTimesheetId, 'INSERT', null, {
      userId,
      date: active.date,
      startTime: active.startTime,
      endTime: timeStr,
      role: roleKey,
      source: 'shift_service_punch_out',
    });

    // Uruchom detektor anomalii dla nowego wpisu RCP
    if (newTimesheetId > 0) {
      await AnomalyEngine.evaluateTimesheet(newTimesheetId);
    }

    console.log(`[ShiftService] Pracownik #${userId} zakończył pracę (${active.startTime} - ${timeStr})`);
    return {
      success: true,
      timesheetId: newTimesheetId,
      duration: `${active.startTime} – ${timeStr}`,
    };
  } catch (error) {
    console.error('[ShiftService] stopShiftAction error:', error);
    return { success: false, error: 'Błąd serwera podczas zatrzymywania usługi pracy.' };
  }
}
