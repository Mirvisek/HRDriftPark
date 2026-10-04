import cron from 'node-cron';
import { db } from '@/db';
import { notifications, timesheets, users, shiftCashReconciliations, shiftChecklistItems, shiftChecklists, shiftReports, workSchedule, settings } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { withCronLock } from '@/lib/cronLock';
import { insertSystemNotification } from '@/lib/notifications';
import { checkConflicts } from '@/lib/timesheetUtils';
import type { TimesheetEntry } from '@/app/actions/timesheetActions';

async function getSettingInt(key: string, fallback: number, min: number, max: number): Promise<number> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    const n = Number(rows[0]?.value ?? fallback);
    if (!Number.isFinite(n) || n < min || n > max) return fallback;
    return Math.trunc(n);
  } catch {
    return fallback;
  }
}

export function initCronJobs() {
  if (typeof window !== 'undefined') return;

  console.log("[CRON] Inicjalizacja harmonogramu zadań automatycznych (Drift Park Extreme)...");

  // 1. Zamknięcie edycji dostępności — codziennie o 00:05, reaguje na skonfigurowany dzień
  cron.schedule('5 0 * * *', async () => {
    await withCronLock('cron_availability_lock_notice', 0, async () => {
      const lockDay = await getSettingInt('cron_availability_lock_day', 15, 1, 28);
      const today = new Date();
      if (today.getDate() !== lockDay + 1) return;

      console.log(`[CRON] [${lockDay + 1}. dzień miesiąca] Blokowanie edycji dyspozycyjności pracowników (lockDay=${lockDay}).`);
      try {
        const allUsers = await db.select({ id: users.id, isDemo: users.isDemo }).from(users);
        for (const u of allUsers) {
          await insertSystemNotification(
            u.id,
            "System automatycznie zamknął edycję dyspozycyjności na ten okres.",
            u.isDemo === true
          );
        }
        console.log("[CRON] Wysłano powiadomienia o zamknięciu edycji dyspozycyjności.");
      } catch (e) {
        console.error("[CRON] Błąd podczas automatycznego powiadamiania o blokadzie dyspozycyjności:", e);
      }
    });
  });

  // 2. Koniec miesiąca — blokada kart + konflikty
  cron.schedule('0 22 * * *', async () => {
    await withCronLock('cron_month_end_timesheets', 0, async () => {
      const today = new Date();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      if (tomorrow.getDate() !== 1) return;

      console.log("[CRON] [Koniec miesiąca, godzina 22:00] Rozpoczęto procedurę blokady kart godzin i analizy konfliktów.");
      try {
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const monthStr = String(month).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const startDate = `${year}-${monthStr}-01`;
        const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        await db
          .update(timesheets)
          .set({ isLocked: true })
          .where(and(gte(timesheets.date, startDate), lte(timesheets.date, endDate)));

        console.log(`[CRON] Pomyślnie zablokowano w bazie dane kart pracy na okres od ${startDate} do ${endDate}`);

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
          })
          .from(timesheets)
          .where(and(gte(timesheets.date, startDate), lte(timesheets.date, endDate)));

        const userEntriesMap: Record<number, TimesheetEntry[]> = {};
        results.forEach((e) => {
          if (!userEntriesMap[e.userId]) userEntriesMap[e.userId] = [];
          userEntriesMap[e.userId].push(e as TimesheetEntry);
        });

        let conflictCount = 0;
        for (const [userId, userEntries] of Object.entries(userEntriesMap)) {
          const conflicts = checkConflicts(userEntries);
          if (conflicts.length > 0) {
            conflictCount += conflicts.length;
            await insertSystemNotification(
              Number(userId),
              `⚠️ Wykryto konflikty (nakładanie się zmian) w Twojej karcie godzin w dniach: ${conflicts.join(', ')}. Popraw dane!`
            );
          }
        }
        console.log(`[CRON] Zweryfikowano konflikty. Znaleziono ${conflictCount} kolizji czasowych.`);
      } catch (e) {
        console.error("[CRON] Błąd procedury zamykania kart godzin:", e);
      }
    });
  });

  // 3. Przypomnienie o zmianie dzień wcześniej — codziennie o pełnej godzinie, filtruje wg ustawienia
  cron.schedule('0 * * * *', async () => {
    await withCronLock('cron_shift_reminders', 0, async () => {
      const reminderHour = await getSettingInt('cron_reminder_hour', 20, 0, 23);
      const now = new Date();
      if (now.getHours() !== reminderHour) return;

      console.log(`[CRON] [Godzina ${reminderHour}:00] Rozpoczęto wysyłanie przypomnień o jutrzejszych dyżurach.`);
      try {
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const tomorrowPlans = await db
          .select()
          .from(workSchedule)
          .where(eq(workSchedule.date, tomorrowStr));

        if (tomorrowPlans.length === 0) {
          console.log(`[CRON] Brak zaplanowanego grafiku na jutro (${tomorrowStr}).`);
          return;
        }

        const { sendPushNotification, getFormattedNotification } = await import("@/lib/webPush");

        for (const plan of tomorrowPlans) {
          const notify = async (userId: number, title: string, msg: string) => {
            await insertSystemNotification(userId, msg, plan.isDemo === true);
            await sendPushNotification(userId, title, msg, '/schedule');
          };

          if (plan.eventRemarks) {
            if (plan.eventUserIds) {
              const ids = plan.eventUserIds.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
              for (const id of ids) {
                const title = "Przypomnienie o wydarzeniu jutro";
                const msg = await getFormattedNotification(
                  'template_shift_reminder_event',
                  { remarks: plan.eventRemarks },
                  `Jutro obsługujesz wydarzenie: "${plan.eventRemarks}".`
                );
                await notify(id, title, msg);
              }
              continue;
            }

            const title = "Wydarzenie na Twojej zmianie";
            const msg = await getFormattedNotification(
              'template_shift_reminder_event',
              { remarks: plan.eventRemarks },
              `Jutro obsługujesz wydarzenie: "${plan.eventRemarks}" (jako osoba z grafiku).`
            );
            if (plan.leadUserId) await notify(plan.leadUserId, title, msg);
            if (plan.supportUserId) await notify(plan.supportUserId, title, msg);
            continue;
          }

          if (plan.isClosed) continue;

          if (plan.leadUserId) {
            const title = "Przypomnienie o dyżurze";
            const msg = await getFormattedNotification(
              'template_shift_reminder_lead',
              {},
              `Jutro masz zaplanowaną zmianę jako Osoba Prowadząca.`
            );
            await notify(plan.leadUserId, title, msg);
          }

          if (plan.supportUserId) {
            const title = "Przypomnienie o dyżurze";
            const msg = await getFormattedNotification(
              'template_shift_reminder_support',
              {},
              `Jutro masz zaplanowaną zmianę jako Osoba Wspomagająca.`
            );
            await notify(plan.supportUserId, title, msg);
          }
        }

        console.log(`[CRON] Pomyślnie wysłano przypomnienia o pracy na jutro.`);
      } catch (err) {
        console.error("[CRON] Błąd podczas wysyłania przypomnień o dyżurach:", err);
      }
    });
  });

  // 4. Przypomnienie o niedomkniętej zmianie — codziennie o 21:30
  cron.schedule('30 21 * * *', async () => {
    await withCronLock('cron_incomplete_close', 0, async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const plans = await db.select().from(workSchedule).where(eq(workSchedule.date, today));
        for (const plan of plans) {
          if (plan.isClosed) continue;
          const recipients = [plan.leadUserId, plan.supportUserId].filter((id): id is number => Boolean(id));
          if (recipients.length === 0) continue;
          const [cash] = await db.select({ id: shiftCashReconciliations.id }).from(shiftCashReconciliations)
            .where(and(eq(shiftCashReconciliations.date, today), eq(shiftCashReconciliations.venueId, plan.venueId || 1), eq(shiftCashReconciliations.isDemo, plan.isDemo))).limit(1);
          const [report] = await db.select({ id: shiftReports.id }).from(shiftReports)
            .where(and(eq(shiftReports.date, today), eq(shiftReports.venueId, plan.venueId || 1), eq(shiftReports.isDemo, plan.isDemo))).limit(1);
          const closingItems = await db.select({ status: shiftChecklistItems.status }).from(shiftChecklistItems)
            .innerJoin(shiftChecklists, eq(shiftChecklistItems.checklistId, shiftChecklists.id))
            .where(and(eq(shiftChecklists.date, today), eq(shiftChecklists.type, 'closing'), eq(shiftChecklists.venueId, plan.venueId || 1), eq(shiftChecklists.isDemo, plan.isDemo)));
          const missing: string[] = [];
          if (!cash) missing.push('rozliczenie kasy');
          if (!report) missing.push('raport zmiany');
          if (closingItems.length > 0 && closingItems.some(item => item.status === 'pending')) missing.push('checklista zamknięcia');
          if (missing.length) {
            const message = `Przypomnienie: przed końcem zmiany uzupełnij: ${missing.join(', ')}.`;
            for (const userId of recipients) {
              await db.insert(notifications).values({ userId, message, isRead: false, isDemo: plan.isDemo });
            }
          }
        }
      } catch (error) {
        console.error('[CRON] Błąd przypomnienia o zamknięciu zmiany:', error);
      }
    });
  });

  // 5. Worker Outbox co minutę
  cron.schedule('* * * * *', async () => {
    await withCronLock('cron_outbox_worker', 0, async () => {
      try {
        const { processPendingOutboxEvents } = await import('@/lib/outbox');
        await processPendingOutboxEvents(50);
      } catch (e) {
        console.error('[CRON] Błąd przetwarzania kolejki Outbox:', e);
      }
    });
  });
}

export default initCronJobs;
