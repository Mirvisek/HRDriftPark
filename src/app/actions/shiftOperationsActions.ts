'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { shiftCashReconciliations, shiftChecklistItems, shiftChecklists, shiftReports, workSchedule } from '@/db/schema';

export type CashFormValues = {
  openingCash: number; closingCash: number; fiscalReport: number; terminalReport: number; blikReport: number;
  cashToBag: number; eventCash: number; cashOperations: number; operationsDescription?: string; differenceDescription?: string;
};
export type ShiftReportValues = { intensity: 'calm' | 'standard' | 'busy'; incidents?: string; equipmentNotes?: string; stockNotes?: string; handoverNotes?: string };

type Scope = { userId: number; name: string; venueId: number; isDemo: boolean };
async function scope(): Promise<Scope | null> {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as typeof session.user & { id?: string; venueId?: number; isDemo?: boolean };
  return { userId: Number(user.id), name: session.user.name || 'Pracownik', venueId: Number(user.venueId || 1), isDemo: user.isDemo === true };
}
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const amount = (value: number) => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
const clean = (value?: string) => value?.trim() || null;

export async function getTodayOverviewAction(date: string) {
  const current = await scope();
  if (!current || !isDate(date)) return { success: false, error: 'Brak autoryzacji lub nieprawidłowa data.' };
  try {
    const filter = and(eq(workSchedule.date, date), eq(workSchedule.venueId, current.venueId), eq(workSchedule.isDemo, current.isDemo));
    const [schedule] = await db.select().from(workSchedule).where(filter).limit(1);
    const checklistRows = await db.select({ type: shiftChecklists.type, status: shiftChecklistItems.status })
      .from(shiftChecklistItems).innerJoin(shiftChecklists, eq(shiftChecklistItems.checklistId, shiftChecklists.id))
      .where(and(eq(shiftChecklists.date, date), eq(shiftChecklists.venueId, current.venueId), eq(shiftChecklists.isDemo, current.isDemo)));
    const [cash] = await db.select().from(shiftCashReconciliations).where(and(eq(shiftCashReconciliations.date, date), eq(shiftCashReconciliations.venueId, current.venueId), eq(shiftCashReconciliations.isDemo, current.isDemo))).limit(1);
    const [report] = await db.select().from(shiftReports).where(and(eq(shiftReports.date, date), eq(shiftReports.venueId, current.venueId), eq(shiftReports.isDemo, current.isDemo))).limit(1);
    const totals = (type: 'opening' | 'closing') => {
      const selected = checklistRows.filter(row => row.type === type);
      return { total: selected.length, done: selected.filter(row => row.status !== 'pending').length, problems: selected.filter(row => row.status === 'problem').length };
    };
    return { success: true, data: { schedule: schedule || null, opening: totals('opening'), closing: totals('closing'), cash: cash || null, report: report || null } };
  } catch (error) { console.error('[Shift operations] overview:', error); return { success: false, error: 'Nie udało się pobrać danych zmiany.' }; }
}

export async function saveCashReconciliationAction(date: string, values: CashFormValues) {
  const current = await scope();
  if (!current || !isDate(date)) return { success: false, error: 'Brak autoryzacji lub nieprawidłowa data.' };
  const data = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'number' ? amount(value) : value])) as CashFormValues;
  const checkAmount = amount((data.closingCash - data.openingCash - data.cashOperations) - (data.fiscalReport - data.terminalReport - data.blikReport));
  if (checkAmount !== 0 && !clean(data.differenceDescription)) return { success: false, error: 'Przy różnicy w kasie podaj jej wyjaśnienie.' };
  if (data.cashOperations !== 0 && !clean(data.operationsDescription)) return { success: false, error: 'Opisz operację gotówkową.' };
  const record = { ...data, checkAmount, operationsDescription: clean(data.operationsDescription), differenceDescription: clean(data.differenceDescription), completedBy: current.userId, completedByName: current.name };
  try {
    const filter = and(eq(shiftCashReconciliations.date, date), eq(shiftCashReconciliations.venueId, current.venueId), eq(shiftCashReconciliations.isDemo, current.isDemo));
    const [existing] = await db.select({ id: shiftCashReconciliations.id }).from(shiftCashReconciliations).where(filter).limit(1);
    if (existing) await db.update(shiftCashReconciliations).set(record).where(eq(shiftCashReconciliations.id, existing.id));
    else await db.insert(shiftCashReconciliations).values({ date, venueId: current.venueId, isDemo: current.isDemo, ...record });
    return { success: true, checkAmount };
  } catch (error) { console.error('[Shift operations] cash:', error); return { success: false, error: 'Nie udało się zapisać rozliczenia kasy.' }; }
}

export async function saveShiftReportAction(date: string, values: ShiftReportValues) {
  const current = await scope();
  if (!current || !isDate(date)) return { success: false, error: 'Brak autoryzacji lub nieprawidłowa data.' };
  const record = { intensity: values.intensity, incidents: clean(values.incidents), equipmentNotes: clean(values.equipmentNotes), stockNotes: clean(values.stockNotes), handoverNotes: clean(values.handoverNotes), completedBy: current.userId, completedByName: current.name };
  try {
    const filter = and(eq(shiftReports.date, date), eq(shiftReports.venueId, current.venueId), eq(shiftReports.isDemo, current.isDemo));
    const [existing] = await db.select({ id: shiftReports.id }).from(shiftReports).where(filter).limit(1);
    if (existing) await db.update(shiftReports).set(record).where(eq(shiftReports.id, existing.id));
    else await db.insert(shiftReports).values({ date, venueId: current.venueId, isDemo: current.isDemo, ...record });
    return { success: true };
  } catch (error) { console.error('[Shift operations] report:', error); return { success: false, error: 'Nie udało się zapisać raportu zmiany.' }; }
}
