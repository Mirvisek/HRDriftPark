'use server';

import { db } from "@/db";
import { operationalDayClosing, shiftCashReconciliations, timesheets, shiftChecklists, shiftTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { runTransaction } from "@/lib/transaction";
import { canTransition } from "@/lib/workflow";

export async function getDayClosingStatusAction(dateStr: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  try {
    const existing = await db
      .select()
      .from(operationalDayClosing)
      .where(and(
        eq(operationalDayClosing.date, dateStr),
        eq(operationalDayClosing.venueId, venueId),
        eq(operationalDayClosing.isDemo, isDemo)
      ))
      .limit(1);

    if (existing.length > 0) {
      return { success: true, isClosed: true, closingData: existing[0] };
    }
    return { success: true, isClosed: false };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function closeOperationalDayAction(
  dateStr: string,
  isForceClose: boolean,
  reasonCode?: string,
  reasonText?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const userId = Number((session.user as any).id);
  const userName = (session.user as any).name || (session.user as any).displayName || 'Manager';
  const userRole = (session.user as any).role || 'employee';
  const venueId = (session.user as any).venueId || 1;
  const isDemo = (session.user as any).isDemo === true;

  if (isForceClose && (!reasonCode || !reasonText)) {
    return { success: false, error: "Wymuszone zamknięcie dnia wymaga wskazania powodu (reasonCode i reasonText)." };
  }

  return await runTransaction(async (tx) => {
    // 1. Sprawdź czy dzień nie jest już zamknięty
    const existing = await tx
      .select()
      .from(operationalDayClosing)
      .where(and(
        eq(operationalDayClosing.date, dateStr),
        eq(operationalDayClosing.venueId, venueId),
        eq(operationalDayClosing.isDemo, isDemo)
      ))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Dzień operacyjny na tę datę został już zamknięty." };
    }

    // 2. Pobierz migawkę operacyjną (Snapshot)
    const cashRecs = await tx.select().from(shiftCashReconciliations).where(and(eq(shiftCashReconciliations.date, dateStr), eq(shiftCashReconciliations.venueId, venueId)));
    const timesheetRecs = await tx.select().from(timesheets).where(eq(timesheets.date, dateStr));
    const checklistsRecs = await tx.select().from(shiftChecklists).where(and(eq(shiftChecklists.date, dateStr), eq(shiftChecklists.venueId, venueId)));
    const tasksRecs = await tx.select().from(shiftTasks).where(and(eq(shiftTasks.date, dateStr), eq(shiftTasks.venueId, venueId)));

    const snapshotData = {
      closedAt: new Date().toISOString(),
      cash: cashRecs[0] || null,
      timesheetsCount: timesheetRecs.length,
      checklistsCount: checklistsRecs.length,
      tasksCompleted: tasksRecs.filter(t => t.isCompleted).length,
      tasksTotal: tasksRecs.length
    };

    // 3. Zablokuj wszystkie powiązane wpisy RCP i kasy dla tego lokalu i dnia
    await tx.update(timesheets)
      .set({ status: 'locked', isLocked: true })
      .where(eq(timesheets.date, dateStr));

    await tx.update(shiftCashReconciliations)
      .set({ status: 'locked' })
      .where(and(eq(shiftCashReconciliations.date, dateStr), eq(shiftCashReconciliations.venueId, venueId)));

    // 4. Zapisz wpis zamknięcia dnia
    const status = isForceClose ? 'closed_with_exceptions' : 'closed';
    await tx.insert(operationalDayClosing).values({
      date: dateStr,
      venueId,
      status,
      snapshot: JSON.stringify(snapshotData),
      closedBy: userId,
      closedByName: userName,
      reasonCode: isForceClose ? reasonCode : null,
      reasonText: isForceClose ? reasonText : null,
      isDemo
    });

    return { success: true, status };
  });
}
