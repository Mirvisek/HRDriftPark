import cron from 'node-cron';
import { db } from '@/db';
import { timesheets, users } from '@/db/schema';
import { eq, like, and } from 'drizzle-orm';

export function initCronJobs() {
  // Sprawdzamy czy nie jesteśmy w przeglądarce
  if (typeof window !== 'undefined') return;
  
  console.log("[CRON] Inicjalizacja harmonogramu zadań automatycznych (Drift Park Extreme)...");

  // 1. Zamknięcie edycji dostępności (15-go dnia miesiąca)
  // Uruchamia się 16-go dnia miesiąca o 00:00:00
  cron.schedule('0 0 16 * *', async () => {
    console.log("[CRON] [16-ty dzień miesiąca] Blokowanie edycji dyspozycyjności pracowników.");
    try {
      // Pobieramy wszystkich użytkowników i wysyłamy powiadomienia
      const allUsers = await db.select({ id: users.id }).from(users);
      const { sendSystemNotification } = await import("@/app/actions/userActions");
      for (const u of allUsers) {
        await sendSystemNotification(u.id, "System automatycznie zamknął edycję dyspozycyjności na ten okres.");
      }
      console.log("[CRON] Wysłano powiadomienia o zamknięciu edycji dyspozycyjności.");
    } catch (e) {
      console.error("[CRON] Błąd podczas automatycznego powiadamiania o blokadzie dyspozycyjności:", e);
    }
  });

  // 2. Karta Godzin Pracy: Ostatniego dnia miesiąca o 22:00 system blokuje edycję i sprawdza konflikty
  // Uruchamia się codziennie o 22:00 i sprawdza, czy dziś jest ostatni dzień miesiąca
  cron.schedule('0 22 * * *', async () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Jeśli jutro to 1 dzień kolejnego miesiąca, dzisiaj jest ostatni dzień miesiąca!
    if (tomorrow.getDate() === 1) {
      console.log("[CRON] [Koniec miesiąca, godzina 22:00] Rozpoczęto procedurę blokady kart godzin i analizy konfliktów.");
      try {
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const monthStr = String(month).padStart(2, '0');
        const pattern = `${year}-${monthStr}-%`;

        // Zablokuj wszystkie wpisy z bieżącego miesiąca w bazie danych
        await db
          .update(timesheets)
          .set({ isLocked: true })
          .where(like(timesheets.date, pattern));
          
        console.log(`[CRON] Pomyślnie zablokowano w bazie dane kart pracy na okres: ${pattern}`);
        
        const { getAllTimesheets } = await import("@/app/actions/timesheetActions");
        const { checkConflicts } = await import("@/lib/timesheetUtils");
        const res = await getAllTimesheets(year, month);
        if (res.success && res.data) {
          // Pogrupuj wpisy dla każdego pracownika i sprawdź konflikty
          const userEntriesMap: Record<number, any[]> = {};
          res.data.forEach(e => {
            if (!userEntriesMap[e.userId]) userEntriesMap[e.userId] = [];
            userEntriesMap[e.userId].push(e);
          });

          let conflictCount = 0;
          for (const [userId, userEntries] of Object.entries(userEntriesMap)) {
            const conflicts = checkConflicts(userEntries);
            if (conflicts.length > 0) {
              conflictCount += conflicts.length;
              // Wyślij powiadomienie do pracownika
              const { sendSystemNotification } = await import("@/app/actions/userActions");
              await sendSystemNotification(Number(userId), `⚠️ Wykryto konflikty (nakładanie się zmian) w Twojej karcie godzin w dniach: ${conflicts.join(', ')}. Popraw dane!`);
            }
          }
          console.log(`[CRON] Zweryfikowano konflikty. Znaleziono ${conflictCount} kolizji czasowych.`);
        }
      } catch (e) {
        console.error("[CRON] Błąd procedury zamykania kart godzin:", e);
      }
    }
  });

  // 3. Przypomnienie o zmianie dzień wcześniej o 20:00
  // Uruchamia się codziennie o 20:00
  cron.schedule('0 20 * * *', async () => {
    console.log("[CRON] [Godzina 20:00] Rozpoczęto wysyłanie przypomnień o jutrzejszych dyżurach.");
    try {
      const today = new Date();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Format YYYY-MM-DD
      
      const { workSchedule } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      
      // Pobierz grafik na jutro
      const tomorrowPlans = await db
        .select()
        .from(workSchedule)
        .where(eq(workSchedule.date, tomorrowStr))
        .limit(1);
        
      if (tomorrowPlans.length === 0) {
        console.log(`[CRON] Brak zaplanowanego grafiku na jutro (${tomorrowStr}).`);
        return;
      }
      
      const plan = tomorrowPlans[0];
      const { sendPushNotification, getFormattedNotification } = await import("@/lib/webPush");
      const { sendSystemNotification } = await import("@/app/actions/userActions");
      
      // 1. Sprawdź czy jest wydarzenie specjalne i przypisane osoby
      if (plan.eventRemarks) {
        if (plan.eventUserIds) {
          // Jeśli przypisano dedykowane osoby do wydarzenia, powiadamiamy je
          const ids = plan.eventUserIds.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
          for (const id of ids) {
            const title = "Przypomnienie o wydarzeniu jutro";
            const msg = await getFormattedNotification(
              'template_shift_reminder_event',
              { remarks: plan.eventRemarks },
              `Jutro obsługujesz wydarzenie: "${plan.eventRemarks}".`
            );
            await sendSystemNotification(id, msg);
            await sendPushNotification(id, title, msg, '/schedule');
          }
          console.log(`[CRON] Wysłano przypomnienia o wydarzeniu do dedykowanych pracowników: ${plan.eventUserIds}`);
          return;
        } else {
          // Jeśli jest wydarzenie, ale brak przypisanych osób – powiadamiamy osoby z głównego grafiku o wydarzeniu
          const title = "Wydarzenie na Twojej zmianie";
          const msg = await getFormattedNotification(
            'template_shift_reminder_event',
            { remarks: plan.eventRemarks },
            `Jutro obsługujesz wydarzenie: "${plan.eventRemarks}" (jako osoba z grafiku).`
          );
          if (plan.leadUserId) {
            await sendSystemNotification(plan.leadUserId, msg);
            await sendPushNotification(plan.leadUserId, title, msg, '/schedule');
          }
          if (plan.supportUserId) {
            await sendSystemNotification(plan.supportUserId, msg);
            await sendPushNotification(plan.supportUserId, title, msg, '/schedule');
          }
          console.log(`[CRON] Wysłano przypomnienia o wydarzeniu do głównej obsady z grafiku (Lead: ${plan.leadUserId}, Support: ${plan.supportUserId}).`);
          return;
        }
      }
      
      // 2. Jeśli brak wydarzenia, powiadamiamy standardową obsadę z grafiku
      if (plan.isClosed) {
        console.log(`[CRON] Jutro lokal jest zamknięty. Brak przypomnień o dyżurach.`);
        return;
      }
      
      if (plan.leadUserId) {
        const title = "Przypomnienie o dyżurze";
        const msg = await getFormattedNotification(
          'template_shift_reminder_lead',
          {},
          `Jutro masz zaplanowaną zmianę jako Osoba Prowadząca.`
        );
        await sendSystemNotification(plan.leadUserId, msg);
        await sendPushNotification(plan.leadUserId, title, msg, '/schedule');
      }
      
      if (plan.supportUserId) {
        const title = "Przypomnienie o dyżurze";
        const msg = await getFormattedNotification(
          'template_shift_reminder_support',
          {},
          `Jutro masz zaplanowaną zmianę jako Osoba Wspomagająca.`
        );
        await sendSystemNotification(plan.supportUserId, msg);
        await sendPushNotification(plan.supportUserId, title, msg, '/schedule');
      }
      
      console.log(`[CRON] Pomyślnie wysłano standardowe przypomnienia o pracy na jutro (Lead: ${plan.leadUserId}, Support: ${plan.supportUserId}).`);
    } catch (err) {
      console.error("[CRON] Błąd podczas wysyłania przypomnień o dyżurach:", err);
    }
  });
}
export default initCronJobs;
