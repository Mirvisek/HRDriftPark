import { db } from "@/db";
import { notifications } from "@/db/schema";

/**
 * Internal notification insert for cron / trusted server code.
 * Not a Server Action — does not require a user session.
 */
export async function insertSystemNotification(
  userId: number,
  message: string,
  isDemo: boolean = false
) {
  if (!Number.isInteger(userId) || userId <= 0) return;
  const text = String(message || "").trim().slice(0, 2000);
  if (!text) return;

  await db.insert(notifications).values({
    userId,
    message: text,
    isRead: false,
    isDemo,
  });
}
