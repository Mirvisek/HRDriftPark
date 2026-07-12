'use server';

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function saveSubscriptionAction(sub: {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Brak autoryzacji" };
  }

  const userId = Number((session.user as any).id);
  if (!userId) {
    return { success: false, error: "Brak ID użytkownika w sesji" };
  }

  try {
    // Sprawdź czy ta subskrypcja (endpoint) już istnieje
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, sub.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Jeśli istnieje, zaktualizuj przypisanie do zalogowanego użytkownika (w razie zmiany konta)
      await db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      // Jeśli nowa, dodaj do bazy
      await db.insert(pushSubscriptions).values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
    }

    console.log(`[Push Subscription] Zapisano subskrypcję dla użytkownika ID: ${userId}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Push Subscription Error] Zapis:", e);
    return { success: false, error: e.message || "Błąd bazy danych" };
  }
}

export async function removeSubscriptionAction(endpoint: string) {
  try {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    console.log(`[Push Subscription] Usunięto subskrypcję dla endpointu: ${endpoint}`);
    return { success: true };
  } catch (e: any) {
    console.error("[Push Subscription Error] Usuwanie:", e);
    return { success: false, error: e.message || "Błąd bazy danych" };
  }
}

export async function testPushNotificationAction() {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Brak autoryzacji" };
  }

  const userId = Number((session.user as any).id);
  if (!userId) {
    return { success: false, error: "Brak ID użytkownika w sesji" };
  }

  try {
    const { sendPushNotification } = await import("@/lib/webPush");
    const res = await sendPushNotification(
      userId,
      "Test Powiadomień Push 🏎️",
      "Powiadomienia push na Twoim telefonie działają prawidłowo!",
      "/timesheet"
    );
    return res;
  } catch (e: any) {
    console.error("[Push Test Error] Wysyłanie:", e);
    return { success: false, error: e.message || "Błąd podczas wysyłania testowego powiadomienia" };
  }
}
