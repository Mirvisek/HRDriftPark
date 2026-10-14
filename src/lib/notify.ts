import { db } from "@/db";
import { notifications } from "@/db/schema";

/** Wewnętrzny zapis powiadomienia, bez sprawdzania sesji. Cron i akcje wołają to po własnej autoryzacji. */
export async function insertNotification(userId: number, message: string, isDemo = false) {
  if (!userId || !message.trim()) return;
  await db.insert(notifications).values({
    userId,
    message: message.slice(0, 500),
    isRead: false,
    isDemo,
  });
}
