'use server';

import { db } from "@/db";
import { activeShifts, timesheets, workSchedule, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { AnomalyEngine } from "@/services/anomalyEngine";
import { logAuditEvent } from "./userActions";
import { 
  ShiftRole, 
  SHIFT_ROLE_LABELS, 
  ActiveShiftInfo, 
  getRoleLabel 
} from "@/lib/shiftTypes";

export type { ShiftRole, ActiveShiftInfo };
export { SHIFT_ROLE_LABELS, getRoleLabel };

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

function extractUserId(sessionUser: any): number {
  const raw = sessionUser?.id || sessionUser?.sub;
  const parsed = Number(raw);
  return isNaN(parsed) ? 0 : parsed;
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

    const userId = extractUserId(session.user);
    if (!userId) {
      return { hasActiveShift: false };
    }

    const venueId = Number((session.user as any)?.venueId || 1);
    const isDemo = (session.user as any)?.isDemo === true;

    const { dateStr } = getPolandDateTime();

    // 1. Sprawdź czy pracownik ma już aktywną zmianę
    const activeList = await db
      .select()
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    // 2. Pobierz grafik na dziś pod kątem sugerowanej roli
    let suggestedRole: ShiftRole = 'lead';
    try {
      const scheduleList = await db
        .select()
        .from(workSchedule)
        .where(and(eq(workSchedule.date, dateStr), eq(workSchedule.venueId, venueId), eq(workSchedule.isDemo, isDemo)))
        .limit(1);

      if (scheduleList.length > 0) {
        const todaySched = scheduleList[0];
        if (todaySched.leadUserId === userId) {
          suggestedRole = 'lead';
        } else if (todaySched.supportUserId === userId) {
          suggestedRole = 'support';
        }
      }
    } catch (schedErr) {
      console.warn('[ShiftService] Warning fetching schedule:', schedErr);
    }

    if (activeList.length > 0) {
      const row = activeList[0];
      const validRole = (row.shiftRole && ['lead', 'support', 'cleaning', 'replacement'].includes(row.shiftRole))
        ? (row.shiftRole as ShiftRole)
        : 'lead';

      return {
        hasActiveShift: true,
        shift: {
          id: row.id,
          userId: row.userId,
          date: String(row.date || dateStr),
          startTime: String(row.startTime || '00:00'),
          startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
          shiftRole: validRole,
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
      return { success: false, error: 'Brak autoryzacji. Zaloguj się ponownie.' };
    }

    const validRoles: ShiftRole[] = ['lead', 'support', 'cleaning', 'replacement'];
    const chosenRole: ShiftRole = validRoles.includes(shiftRole) ? shiftRole : 'lead';

    const userId = extractUserId(session.user);
    if (!userId) {
      return { success: false, error: 'Brak poprawnego ID użytkownika w sesji. Zaloguj się ponownie.' };
    }

    const venueId = Number((session.user as any)?.venueId || 1);
    const isDemo = (session.user as any)?.isDemo === true;

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
      shiftRole: chosenRole,
      venueId,
      isDemo,
    });

    console.log(`[ShiftService] Pracownik #${userId} rozpoczął pracę (${chosenRole}) o ${timeStr}`);
    return {
      success: true,
      startTime: timeStr,
      roleLabel: getRoleLabel(chosenRole),
    };
  } catch (error: any) {
    console.error('[ShiftService] startShiftAction error:', error);
    return { success: false, error: error?.message || 'Błąd serwera podczas uruchamiania usługi pracy.' };
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

    const userId = extractUserId(session.user);
    if (!userId) {
      return { success: false, error: 'Brak ID użytkownika.' };
    }

    const isDemo = (session.user as any)?.isDemo === true;

    const activeList = await db
      .select()
      .from(activeShifts)
      .where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)))
      .limit(1);

    if (activeList.length === 0) {
      return { success: false, error: 'Brak aktywnej zmiany do zakończenia.' };
    }

    const active = activeList[0];
    const { timeStr, dateStr } = getPolandDateTime();
    const roleKey = (active.shiftRole as ShiftRole) || 'lead';
    const roleLabel = getRoleLabel(roleKey);
    const remarks = `Rola na zmianie: ${roleLabel}`;

    const shiftDate = String(active.date || dateStr);
    const shiftStart = String(active.startTime || timeStr);

    let newTimesheetId = 0;
    try {
      // Wstaw wpis do timesheets
      const [inserted] = await db.insert(timesheets).values({
        userId,
        date: shiftDate,
        startTime: shiftStart,
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
      newTimesheetId = (inserted as { insertId?: number }).insertId || 0;
    } catch (insertErr) {
      console.error('[ShiftService] Timesheet insert error:', insertErr);
    }

    // Usuń z tabeli aktywnych zmian ZAWSZE, aby pracownik nie został zablokowany
    await db.delete(activeShifts).where(eq(activeShifts.id, active.id));

    // Log audytowy
    try {
      await logAuditEvent(userId, 'timesheet', newTimesheetId, 'INSERT', null, {
        userId,
        date: shiftDate,
        startTime: shiftStart,
        endTime: timeStr,
        role: roleKey,
        source: 'shift_service_punch_out',
      });
    } catch (auditErr) {
      console.warn('[ShiftService] Audit log warning:', auditErr);
    }

    // Uruchom detektor anomalii
    if (newTimesheetId > 0) {
      try {
        await AnomalyEngine.evaluateTimesheet(newTimesheetId);
      } catch (anomErr) {
        console.warn('[ShiftService] Anomaly evaluation warning:', anomErr);
      }
    }

    console.log(`[ShiftService] Pracownik #${userId} zakończył pracę (${shiftStart} - ${timeStr})`);
    return {
      success: true,
      timesheetId: newTimesheetId,
      duration: `${shiftStart} – ${timeStr}`,
    };
  } catch (error: any) {
    console.error('[ShiftService] stopShiftAction error:', error);
    return { success: false, error: error?.message || 'Błąd serwera podczas zatrzymywania usługi pracy.' };
  }
}

/**
 * Awaryjne zresetowanie zablokowanej zmiany użytkownika (gdyby cokolwiek utknęło w bazie).
 */
export async function resetActiveShiftAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Brak autoryzacji.' };
    }

    const userId = extractUserId(session.user);
    const isDemo = (session.user as any)?.isDemo === true;

    await db.delete(activeShifts).where(and(eq(activeShifts.userId, userId), eq(activeShifts.isDemo, isDemo)));
    return { success: true };
  } catch (error: any) {
    console.error('[ShiftService] resetActiveShiftAction error:', error);
    return { success: false, error: error?.message || 'Błąd resetowania.' };
  }
}
