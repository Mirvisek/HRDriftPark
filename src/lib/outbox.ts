import { db } from '@/db';
import { outboxEvents, notifications, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/webPush';

export interface DomainOutboxEvent {
  eventType: string;
  payload: Record<string, any>;
}

/**
 * Rejestruje zdarzenie wyjściowe w tabeli outbox_events.
 * Może być wywoływana wewnątrz transakcji bazodanowej `tx` lub z wywołania głównego `db`.
 */
export async function recordOutboxEvent(
  eventType: string,
  payload: Record<string, any>,
  dbTx?: any
): Promise<number> {
  const client = dbTx || db;
  const jsonPayload = JSON.stringify(payload);

  const res = await client.insert(outboxEvents).values({
    eventType,
    payload: jsonPayload,
    status: 'pending',
    retryCount: 0
  });

  return (res as any)[0]?.insertId || 0;
}

/**
 * Worker przetwarzający oczekujące zdarzenia w tle (Transactional Outbox Processor).
 */
export async function processPendingOutboxEvents(batchSize: number = 10): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const pendingEvents = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'pending'))
    .limit(batchSize);

  for (const event of pendingEvents) {
    try {
      await db
        .update(outboxEvents)
        .set({ status: 'processing' })
        .where(eq(outboxEvents.id, event.id));

      const payload = JSON.parse(event.payload);

      console.log(`[Outbox Worker] Processing event #${event.id} (${event.eventType}):`, payload);

      // Routing zdarzeń biznesowych
      switch (event.eventType) {
        case 'ALERT_CREATED': {
          const { title, severity, employeeId } = payload;
          const alertMsg = `[Alert ${String(severity).toUpperCase()}] ${title}`;

          // 1. Powiadomienie pracownika (jeśli dotyczy konkretnego pracownika)
          if (employeeId) {
            await db.insert(notifications).values({
              userId: Number(employeeId),
              message: alertMsg,
              isRead: false
            });
            await sendPushNotification(Number(employeeId), `⚠️ Alert systemu: ${title}`, alertMsg, '/alerts');
          }

          // 2. Jeśli alert jest oznaczony jako high lub critical, powiadom kadrę zarządzającą
          if (severity === 'high' || severity === 'critical') {
            const managers = await db
              .select({ id: users.id })
              .from(users)
              .where(or(eq(users.role, 'owner'), eq(users.role, 'manager')));

            for (const m of managers) {
              if (m.id !== employeeId) {
                await db.insert(notifications).values({
                  userId: m.id,
                  message: `[Krytyczny alert kadrowy] ${title}`,
                  isRead: false
                });
                await sendPushNotification(m.id, `🚨 Krytyczny alert kadrowy`, title, '/alerts');
              }
            }
          }
          break;
        }

        default:
          console.log(`[Outbox Worker] Brak dedykowanego handlera dla typu: ${event.eventType}. Zdarzenie uznane za przetworzone.`);
          break;
      }

      await db
        .update(outboxEvents)
        .set({
          status: 'delivered',
          processedAt: new Date()
        })
        .where(eq(outboxEvents.id, event.id));

      processed++;
    } catch (err: any) {
      failed++;
      const nextRetry = (event.retryCount || 0) + 1;
      const status = nextRetry >= 5 ? 'failed' : 'pending';

      await db
        .update(outboxEvents)
        .set({
          status,
          retryCount: nextRetry,
          errorDetails: err.message || 'Error processing outbox event'
        })
        .where(eq(outboxEvents.id, event.id));
    }
  }

  return { processed, failed };
}
