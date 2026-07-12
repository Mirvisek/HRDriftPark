import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Konfiguracja VAPID
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:admin@driftparkextreme.pl',
    publicKey,
    privateKey
  );
}

export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  url: string = '/'
) {
  // Czy działamy w trybie mockowania?
  const mockWebPush = process.env.MOCK_WEB_PUSH === 'true';
  if (mockWebPush) {
    console.log(`[MOCK PUSH] do użytkownika ID: ${userId}. Tytuł: "${title}", Treść: "${body}", URL: "${url}"`);
    return { success: true, mocked: true };
  }

  if (!publicKey || !privateKey) {
    console.warn(`[Web Push] Brak skonfigurowanych kluczy VAPID. Powiadomienie nie zostało wysłane.`);
    return { success: false, error: 'Brak kluczy VAPID' };
  }

  try {
    // Pobierz subskrypcje z bazy danych
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) {
      console.log(`[Web Push] Użytkownik ID ${userId} nie posiada zarejestrowanych urządzeń.`);
      return { success: true, sentCount: 0 };
    }

    const payload = JSON.stringify({ title, body, url });
    let sentCount = 0;

    for (const sub of subs) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (err: any) {
        // Jeśli urządzenie wygasło lub subskrypcja jest nieaktywna (410 Gone lub 404 Not Found), usuwamy ją z bazy
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Web Push] Subskrypcja wygasła (status ${err.statusCode}). Usuwanie z bazy: ${sub.endpoint}`);
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error(`[Web Push] Błąd wysyłania do urządzenia ${sub.endpoint}:`, err);
        }
      }
    }

    console.log(`[Web Push] Wysłano ${sentCount} powiadomień do użytkownika ID: ${userId}`);
    return { success: true, sentCount };
  } catch (e: any) {
    console.error(`[Web Push] Błąd ogólny podczas wysyłania do użytkownika ${userId}:`, e);
    return { success: false, error: e.message || 'Błąd serwera' };
  }
}
