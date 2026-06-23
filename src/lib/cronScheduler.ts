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
}
export default initCronJobs;
