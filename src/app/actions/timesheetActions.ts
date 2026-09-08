'use server';

import { db } from "@/db";
import { timesheets, users, salaryHistory } from "@/db/schema";
import { eq, and, like, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { logAuditEvent } from "./userActions";
import { hasPermission } from "@/lib/permissions";
import { canTransition } from "@/lib/workflow";
import { executeIdempotentAction, runTransaction } from "@/lib/transaction";
import { AnomalyEngine } from "@/services/anomalyEngine";

export interface TimesheetEntry {
  id?: number;
  userId: number;
  date: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  remarks: string | null;
  status?: string;
  isLocked: boolean;
  userName?: string;
  position?: string;
  version?: number;
  effectiveAt?: string | null;
  correctedAt?: Date | null;
  originalId?: number | null;
  reasonCode?: string | null;
  reasonText?: string | null;
}

export async function checkTimesheetLocked(year: number, month: number, user: any) {
  if (hasPermission(user, 'timesheet:edit_all')) {
    return false;
  }

  const now = new Date();
  const lastDay = new Date(year, month, 0);
  lastDay.setHours(22, 0, 0, 0);

  return now.getTime() > lastDay.getTime();
}

export async function getTimesheets(userId: number, year: number, month: number) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  try {
    const session = await auth();
    const userIsDemo = (session?.user as any)?.isDemo === true;

    const results = await db
      .select()
      .from(timesheets)
      .where(
        and(
          eq(timesheets.userId, userId),
          like(timesheets.date, pattern),
          eq(timesheets.isDemo, userIsDemo)
        )
      );

    const userHistory = await db
      .select()
      .from(salaryHistory)
      .where(eq(salaryHistory.userId, userId));

    const userResult = await db
      .select({ hourlyRate: users.hourlyRate })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fallbackRate = userResult.length > 0 ? userResult[0].hourlyRate : 0;

    let estimatedPayout = 0;
    results.forEach(t => {
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      let diffSec = (eh * 3600 + em * 60) - (sh * 3600 + sm * 60);
      if (diffSec <= 0) diffSec += 86400; // Przejście przez północ

      const entryHours = diffSec / 3600;
      const effectiveDate = t.effectiveAt || t.date;
      const matchedRate = userHistory.find(h => {
        return h.validFrom <= effectiveDate && (!h.validTo || h.validTo >= effectiveDate);
      });
      const rate = matchedRate ? matchedRate.hourlyRate : fallbackRate;
      estimatedPayout += entryHours * rate;
    });

    return { 
      success: true, 
      data: results as TimesheetEntry[],
      estimatedPayout: Math.round(estimatedPayout * 100) / 100
    };
  } catch (e) {
    console.error("Błąd pobierania kart godzin:", e);
    return { success: false, data: [], estimatedPayout: 0, error: "Błąd bazy danych podczas pobierania kart godzin." };
  }
}

export async function saveTimesheet(
  id: number | undefined,
  userId: number,
  dateStr: string,
  startTime: string,
  endTime: string,
  remarks: string | null,
  clientVersion?: number,
  idempotencyKey?: string,
  reasonCode?: string,
  reasonText?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };

  const executorId = Number((session.user as any).id);
  const userRole = (session.user as any).role || 'employee';

  if (userId !== executorId && !hasPermission(session.user, 'timesheet:edit_all')) {
    return { success: false, error: "Brak uprawnień do edycji kart godzin innych pracowników." };
  }

  return (await executeIdempotentAction(executorId, 'saveTimesheet', idempotencyKey, async (tx) => {
    const client = tx || db;

    if (id) {
      const existing = await client.select().from(timesheets).where(eq(timesheets.id, id)).limit(1);
      if (existing.length === 0) return { success: false, error: "Nie znaleziono wpisu." };

      const current = existing[0];
      const transitionCheck = canTransition('timesheet', current.status || 'draft', current.status || 'draft', { id: executorId, role: userRole });

      // Jeśli status to LOCKED lub zablokowany, utwórz wpis KOREKTY
      if (current.status === 'locked' || current.isLocked) {
        if (!reasonCode || !reasonText) {
          return { success: false, error: "Modyfikacja zablokowanego wpisu wymaga podania powodu (reasonCode i reasonText)." };
        }

        const [correctionRes] = await client.insert(timesheets).values({
          userId,
          date: dateStr,
          startTime,
          endTime,
          remarks: `Korekta wpisu #${id}: ${remarks || ''}`,
          status: 'submitted',
          isLocked: false,
          effectiveAt: dateStr,
          correctedAt: new Date(),
          originalId: id,
          reasonCode,
          reasonText,
          createdById: executorId,
          isDemo: (session.user as any).isDemo === true,
          version: 1
        });

        const newId = (correctionRes as any).insertId || 0;
        await logAuditEvent(executorId, 'timesheet', newId, 'CORRECTION', current, {
          originalId: id,
          startTime,
          endTime,
          reasonCode,
          reasonText
        });

        await AnomalyEngine.evaluateTimesheet(newId);
        return { success: true, correctionId: newId, message: "Korekta została zarejestrowana z datą obowiązywania (effectiveAt)." };
      }

      if (clientVersion !== undefined && current.version !== clientVersion) {
        return { success: false, error: "Konflikt edycji: Ten wpis został zmodyfikowany przez innego użytkownika. Odśwież stronę." };
      }

      const nextVersion = (current.version || 1) + 1;

      await logAuditEvent(executorId, 'timesheet', id, 'UPDATE', current, { startTime, endTime, remarks, version: nextVersion });

      await client
        .update(timesheets)
        .set({ startTime, endTime, remarks, version: nextVersion })
        .where(and(eq(timesheets.id, id), eq(timesheets.version, current.version)));

      await AnomalyEngine.evaluateTimesheet(id);
    } else {
      const [insertResult] = await client.insert(timesheets).values({
        userId,
        date: dateStr,
        startTime,
        endTime,
        remarks,
        status: 'draft',
        isLocked: false,
        createdById: executorId,
        isDemo: (session.user as any).isDemo === true,
        version: 1
      });

      const newId = (insertResult as any).insertId || 0;
      await logAuditEvent(executorId, 'timesheet', newId, 'INSERT', null, { userId, date: dateStr, startTime, endTime, remarks, version: 1 });

      await AnomalyEngine.evaluateTimesheet(newId);
    }
    return { success: true };
  })).data;
}

export async function deleteTimesheet(id: number, reasonCode?: string, reasonText?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji." };

  const executorId = Number((session.user as any).id);
  const userRole = (session.user as any).role || 'employee';

  try {
    const existing = await db.select().from(timesheets).where(eq(timesheets.id, id)).limit(1);
    if (existing.length === 0) return { success: false, error: "Nie znaleziono wpisu." };

    const current = existing[0];
    if (current.userId !== executorId && !hasPermission(session.user, 'timesheet:edit_all')) {
      return { success: false, error: "Brak uprawnień do usuwania wpisów." };
    }

    if (current.status === 'locked' || current.isLocked) {
      return { success: false, error: "Rekord zablokowany (LOCKED). Nie można go bezpośrednio usunąć." };
    }

    await logAuditEvent(executorId, 'timesheet', id, 'DELETE', current, null);
    await db.delete(timesheets).where(eq(timesheets.id, id));
    return { success: true };
  } catch (e: any) {
    console.error("Błąd usuwania wpisu:", e);
    return { success: false, error: "Błąd serwera podczas usuwania wpisu." };
  }
}

export async function getAllTimesheets(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, data: [] };

  if (!hasPermission(session.user, 'timesheet:view_all')) {
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
        status: timesheets.status,
        isLocked: timesheets.isLocked,
        userName: users.displayName,
        position: users.position,
        reasonCode: timesheets.reasonCode,
        reasonText: timesheets.reasonText
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

export async function getPayrollSummary(year: number, month: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  if (!hasPermission(session.user, 'payroll:view')) {
    return { success: false, error: "Brak uprawnień" };
  }

  try {
    const userIsDemo = (session.user as any).isDemo === true;
    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}-%`;

    const allUsers = await db
      .select({
        id: users.id,
        name: users.displayName,
        role: users.role,
        position: users.position,
        hourlyRate: users.hourlyRate
      })
      .from(users)
      .where(eq(users.isDemo, userIsDemo));

    const allTimesheets = await db
      .select()
      .from(timesheets)
      .where(and(like(timesheets.date, pattern), eq(timesheets.isDemo, userIsDemo)));

    const allSalaryHistory = await db.select().from(salaryHistory);

    const payrollData = allUsers.map(user => {
      const userSheets = allTimesheets.filter(t => t.userId === user.id);
      const userHistory = allSalaryHistory.filter(h => h.userId === user.id);

      let totalSeconds = 0;
      let totalPayout = 0;

      userSheets.forEach(t => {
        const [sh, sm] = t.startTime.split(':').map(Number);
        const [eh, em] = t.endTime.split(':').map(Number);
        let diffSec = (eh * 3600 + em * 60) - (sh * 3600 + sm * 60);
        if (diffSec <= 0) diffSec += 86400;

        totalSeconds += diffSec;
        const entryHours = diffSec / 3600;

        const effectiveDate = t.effectiveAt || t.date;
        const matchedRate = userHistory.find(h => {
          return h.validFrom <= effectiveDate && (!h.validTo || h.validTo >= effectiveDate);
        });

        const rate = matchedRate ? matchedRate.hourlyRate : user.hourlyRate;
        totalPayout += entryHours * rate;
      });

      const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;
      const payout = Math.round(totalPayout * 100) / 100;

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        position: user.position,
        hourlyRate: user.hourlyRate,
        totalHours,
        payout
      };
    });

    return { success: true, data: payrollData };
  } catch (e: any) {
    console.error("Błąd pobierania podsumowania płac:", e);
    return { success: false, error: "Błąd bazy danych podczas wyliczania płac." };
  }
}
