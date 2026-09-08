import { db } from '@/db';
import { alerts, timesheets, workSchedule } from '@/db/schema';
import { recordOutboxEvent } from '@/lib/outbox';
import { eq, and, sql } from 'drizzle-orm';

export interface AnomalyReport {
  ruleCode: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  title: string;
  message: string;
  entityType: string;
  entityId: number;
  venueId?: number;
  employeeId?: number;
  shiftId?: number;
}

/**
 * Moduł Detektora Anomalii (Decoupled Anomaly Engine)
 */
export class AnomalyEngine {
  /**
   * Analizuje rekord RCP pod kątem anomalii i rejestruje odpowiednie alerty
   */
  static async evaluateTimesheet(timesheetId: number): Promise<AnomalyReport[]> {
    const records = await db
      .select()
      .from(timesheets)
      .where(eq(timesheets.id, timesheetId))
      .limit(1);

    if (records.length === 0) return [];
    const ts = records[0];

    const reports: AnomalyReport[] = [];

    // Helper do parsowania minut
    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const startMins = timeToMinutes(ts.startTime);
    const endMins = timeToMinutes(ts.endTime);
    let durationHours = (endMins - startMins) / 60;
    if (durationHours < 0) durationHours += 24; // Przejście przez północ

    // 1. LongShiftRule: Zmiana > 8h bez zarejestrowanej przerwy
    if (durationHours > 8) {
      reports.push({
        ruleCode: 'LONG_SHIFT_NO_BREAK',
        severity: 'medium',
        confidence: 0.95,
        title: '⚠️ Wymaga weryfikacji — długa zmiana',
        message: `Pracownik przepracował ${durationHours.toFixed(1)}h. Wymagana weryfikacja czy zarejestrowano przerwę w pracy.`,
        entityType: 'timesheet',
        entityId: ts.id,
        employeeId: ts.userId
      });
    }

    // 2. MissingCheckoutRule: Zmiana > 14h
    if (durationHours > 14) {
      reports.push({
        ruleCode: 'MISSING_CHECKOUT',
        severity: 'critical',
        confidence: 0.99,
        title: '🔴 Brak Checkoutu / Przekroczenie Czasu',
        message: `Wpis RCP wykazuje zmianę trwającą ${durationHours.toFixed(1)}h. Prawdopodobny brak zamknięcia zmiany przez pracownika.`,
        entityType: 'timesheet',
        entityId: ts.id,
        employeeId: ts.userId
      });
    }

    // 3. PlanRealityDeviationRule: Porównanie z grafikiem planowanym
    const scheduleRecords = await db
      .select()
      .from(workSchedule)
      .where(eq(workSchedule.date, ts.date));

    if (scheduleRecords.length > 0) {
      const sched = scheduleRecords[0];
      if (sched.openTime && sched.closeTime) {
        const planStartMins = timeToMinutes(sched.openTime);
        const planEndMins = timeToMinutes(sched.closeTime);

        const startDiff = Math.abs(startMins - planStartMins);
        const endDiff = Math.abs(endMins - planEndMins);

        if (startDiff > 15 || endDiff > 15) {
          reports.push({
            ruleCode: 'PLAN_REALITY_DEVIATION',
            severity: 'low',
            confidence: 0.9,
            title: '🟠 Rozbieżność z Grafikiem',
            message: `Godziny RCP (${ts.startTime}-${ts.endTime}) różnią się od grafiku planowanego (${sched.openTime}-${sched.closeTime}) o ponad 15 minut.`,
            entityType: 'timesheet',
            entityId: ts.id,
            venueId: sched.venueId || undefined,
            employeeId: ts.userId
          });
        }
      }
    }

    // 4. Zapis wykrytych anomalii do bazy bazy danych i Outbox
    for (const report of reports) {
      const [inserted] = await db.insert(alerts).values({
        ruleCode: report.ruleCode,
        severity: report.severity,
        confidence: report.confidence,
        source: 'anomaly_engine',
        title: report.title,
        message: report.message,
        status: 'open',
        entityType: report.entityType,
        entityId: report.entityId,
        venueId: report.venueId,
        employeeId: report.employeeId,
        shiftId: report.shiftId,
        isDemo: ts.isDemo
      });

      // Zgłoszenie zdarzenia outbox dla alertów HIGH i CRITICAL
      if (report.severity === 'high' || report.severity === 'critical') {
        await recordOutboxEvent('ALERT_CREATED', {
          alertId: (inserted as any).insertId,
          ruleCode: report.ruleCode,
          severity: report.severity,
          title: report.title,
          employeeId: report.employeeId
        });
      }
    }

    return reports;
  }

  /**
   * Sprawdza wymóg 11-godzinnego odpoczynku dobowego dla pracownika między dwoma zmianami
   */
  static async checkRestPeriodViolation(
    employeeId: number,
    currentShiftDate: string,
    currentStartTime: string
  ): Promise<{ hasViolation: boolean; restHours?: number }> {
    // Pobierz poprzedni wpis z poprzedniego dnia
    const prevShifts = await db
      .select()
      .from(timesheets)
      .where(and(eq(timesheets.userId, employeeId), sql`date < ${currentShiftDate}`))
      .orderBy(sql`date DESC, end_time DESC`)
      .limit(1);

    if (prevShifts.length === 0) {
      return { hasViolation: false };
    }

    const prev = prevShifts[0];
    const prevDate = new Date(`${prev.date}T${prev.endTime}:00`);
    const currDate = new Date(`${currentShiftDate}T${currentStartTime}:00`);

    const diffMs = currDate.getTime() - prevDate.getTime();
    const restHours = diffMs / (1000 * 60 * 60);

    if (restHours < 11) {
      return { hasViolation: true, restHours };
    }

    return { hasViolation: false, restHours };
  }
}
